import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import * as Public from "./public.mts";

test("loads and typechecks every public module in the installed package", () => {
  const packageRoot = dirname(
    fileURLToPath(import.meta.resolve("effect-units/package.json")),
  );
  const modules = readdirSync(join(packageRoot, "dist"))
    .filter((name) => name.endsWith(".js"))
    .map((name) => name.slice(0, -3));

  assert.deepEqual(Object.keys(Public).sort(), modules.sort());
});

test("rejects private imports at runtime and in both TypeScript resolution modes", async () => {
  const imports = [
    // @ts-expect-error Internal modules are not public.
    () => import("effect-units/internal"),
    // @ts-expect-error Internal modules are not public.
    () => import("effect-units/internal/constants"),
    // @ts-expect-error Internal modules are not public.
    () => import("effect-units/internal/constants.js"),
    // @ts-expect-error Internal modules are not public.
    () => import("effect-units/internal/constantsExact"),
    // @ts-expect-error Internal modules are not public.
    () => import("effect-units/internal/constantsExact.js"),
    // @ts-expect-error Internal modules are not public.
    () => import("effect-units/internal/dimensionless"),
    // @ts-expect-error Internal modules are not public.
    () => import("effect-units/internal/dimensionless.js"),
    // @ts-expect-error Internal modules are not public.
    () => import("effect-units/internal/prefixExact"),
    // @ts-expect-error Internal modules are not public.
    () => import("effect-units/internal/prefixExact.js"),
    // @ts-expect-error Internal modules are not public.
    () => import("effect-units/internal/valueObject"),
    // @ts-expect-error Internal modules are not public.
    () => import("effect-units/internal/valueObject.js"),
  ];

  await Promise.all(
    imports.map((load) =>
      assert.rejects(load, { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" }),
    ),
  );
});
