#!/usr/bin/env node
/**
 * End-to-end installability check for the parent repo:
 *   1. build + pack every workspace package
 *   2. npm install the tarballs in a throw-away project (file: specs)
 *   3. run scripts/parent-consumer-smoke.mjs from that project
 *
 * This is evidence of installability, not of a real parent-repo integration:
 * /agente is never modified.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(root, "artifacts", "parent-install");
const consumerDir = join(root, "artifacts", "parent-verify");

console.log("[verify:parent] packing");
execFileSync(process.execPath, [join(root, "scripts", "pack-parent.mjs")], { cwd: root, stdio: "inherit" });

const snapshot = JSON.parse(readFileSync(join(outDir, "parent-install.json"), "utf8"));
rmSync(consumerDir, { recursive: true, force: true });
mkdirSync(consumerDir, { recursive: true });

const dependencies = Object.fromEntries(
  snapshot.packages.map((entry) => [entry.name, `file:${join(outDir, entry.tarball)}`]),
);
writeFileSync(
  join(consumerDir, "package.json"),
  `${JSON.stringify(
    {
      name: "agntia-branding-parent-consumer",
      version: "0.0.0",
      private: true,
      type: "module",
      description: "Throw-away parent-repo consumer used by scripts/verify-parent-install.mjs",
      dependencies,
    },
    null,
    2,
  )}\n`,
);

console.log("[verify:parent] npm install (file: tarballs)");
execFileSync("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts", "--no-package-lock"], {
  cwd: consumerDir,
  stdio: "inherit",
});

copyFileSync(join(root, "scripts", "parent-consumer-smoke.mjs"), join(consumerDir, "smoke.mjs"));
console.log("[verify:parent] running consumer smoke");
execFileSync(process.execPath, [join(consumerDir, "smoke.mjs")], { cwd: consumerDir, stdio: "inherit" });

copyFileSync(join(root, "scripts", "parent-consumer-typecheck.ts"), join(consumerDir, "typecheck.ts"));
writeFileSync(
  join(consumerDir, "tsconfig.json"),
  `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        noUncheckedIndexedAccess: true,
        skipLibCheck: false,
        noEmit: true,
        types: [],
      },
      include: ["typecheck.ts"],
    },
    null,
    2,
  )}\n`,
);
console.log("[verify:parent] typechecking a TypeScript consumer");
execFileSync(
  process.execPath,
  [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", join(consumerDir, "tsconfig.json")],
  { cwd: consumerDir, stdio: "inherit" },
);

console.log(`[verify:parent] PASS · ${snapshot.packages.length} packages installed, imported and typechecked`);
