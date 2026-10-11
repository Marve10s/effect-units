import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const project = join(import.meta.dirname, "..");
const manifest = JSON.parse(
  readFileSync(join(project, "package.json"), "utf8"),
);
const consumer = mkdtempSync(join(tmpdir(), "effect-units-consumer-"));

try {
  execFileSync("pnpm", ["pack", "--pack-destination", consumer], {
    cwd: project,
    env: { ...process.env, CI: "1" },
    stdio: "inherit",
  });

  const tarballs = readdirSync(consumer).filter((name) =>
    name.endsWith(".tgz"),
  );
  assert.equal(tarballs.length, 1);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        "effect-units": `file:./${tarballs[0]}`,
        effect: manifest.devDependencies.effect,
      },
      devDependencies: {
        typescript: manifest.devDependencies.typescript,
        "@types/node": manifest.devDependencies["@types/node"],
      },
    }),
  );

  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
    ],
    {
      cwd: consumer,
      stdio: "inherit",
    },
  );

  const modules = readdirSync(join(project, "src"))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => name.slice(0, -3));
  const internalPaths = [
    "effect-units/internal",
    ...readdirSync(join(project, "src", "internal"))
      .filter((name) => name.endsWith(".ts"))
      .flatMap((name) => [
        `effect-units/internal/${name.slice(0, -3)}`,
        `effect-units/internal/${name.slice(0, -3)}.js`,
      ]),
  ];

  writeFileSync(
    join(consumer, "public.mts"),
    modules
      .map((name) => `export * as ${name} from "effect-units/${name}";`)
      .join("\n"),
  );
  writeFileSync(
    join(consumer, "private.mts"),
    internalPaths
      .map(
        (path, index) =>
          `// @ts-expect-error Internal modules are not public.\nimport * as Internal${index} from ${JSON.stringify(path)};\nvoid Internal${index};`,
      )
      .join("\n"),
  );
  writeFileSync(
    join(consumer, "exports.mjs"),
    `
import assert from "node:assert/strict";
await import("./out/public.mjs");
for (const path of ${JSON.stringify(internalPaths)}) {
  await assert.rejects(import(path), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
}
`,
  );
  copyFileSync(
    join(project, "scripts", "package", "consumer.mts"),
    join(consumer, "consumer.mts"),
  );

  const tsc = join(consumer, "node_modules", "typescript", "bin", "tsc");
  const options = [
    "--strict",
    "--types",
    "node",
    "--target",
    "ES2022",
    "--lib",
    "ESNext,DOM",
    "consumer.mts",
    "public.mts",
    "private.mts",
  ];
  execFileSync(
    process.execPath,
    [tsc, ...options, "--module", "NodeNext", "--outDir", "out"],
    {
      cwd: consumer,
      stdio: "inherit",
    },
  );
  execFileSync(
    process.execPath,
    [
      tsc,
      ...options,
      "--module",
      "ESNext",
      "--moduleResolution",
      "Bundler",
      "--noEmit",
    ],
    {
      cwd: consumer,
      stdio: "inherit",
    },
  );
  execFileSync(process.execPath, ["exports.mjs"], {
    cwd: consumer,
    stdio: "inherit",
  });
  execFileSync(process.execPath, ["out/consumer.mjs"], {
    cwd: consumer,
    stdio: "inherit",
  });
  console.log(
    `Packed consumer passed: ${modules.length} public modules load, internal paths are blocked, NodeNext and Bundler declarations compile, and conversions/codecs round-trip.`,
  );
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
