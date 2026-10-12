import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import * as Public from "./public.mts";

const packageRoot = dirname(
  fileURLToPath(import.meta.resolve("effect-units/package.json")),
);

test("loads and typechecks every public module in the installed package", () => {
  const modules = readdirSync(join(packageRoot, "dist"))
    .filter((name) => name.endsWith(".js"))
    .map((name) => name.slice(0, -3));

  assert.deepEqual(Object.keys(Public).sort(), modules.sort());
});

test("rejects private imports at runtime and in both TypeScript resolution modes", async () => {
  await assert.rejects(
    // @ts-expect-error Internal modules are not public.
    () => import("effect-units/internal"),
    { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" },
  );

  const modules = readdirSync(join(packageRoot, "dist", "internal"), {
    encoding: "utf8",
    recursive: true,
  })
    .filter((name) => name.endsWith(".js"))
    .map((name) => name.replaceAll("\\", "/"));
  assert.ok(modules.length > 0);

  const paths = modules.flatMap((name) => [
    `effect-units/internal/${name.slice(0, -3)}`,
    `effect-units/internal/${name}`,
  ]);
  const resolutions = [
    {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    },
    {
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
  ] satisfies ReadonlyArray<ts.CompilerOptions>;

  await Promise.all(
    paths.map(async (specifier) => {
      resolutions.forEach((options) => {
        assert.equal(
          ts.resolveModuleName(
            specifier,
            import.meta.filename,
            options,
            ts.sys,
            undefined,
            undefined,
            ts.ModuleKind.ESNext,
          ).resolvedModule,
          undefined,
          `${specifier} must be private in ${ts.ModuleResolutionKind[options.moduleResolution]}`,
        );
      });
      await assert.rejects(
        () => import(specifier),
        { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" },
        specifier,
      );
    }),
  );
});
