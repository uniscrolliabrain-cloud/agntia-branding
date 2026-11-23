#!/usr/bin/env node
/**
 * Builds every workspace package to dist/ (ESM + .d.ts) in dependency order.
 *
 * The packages are installed by the parent repo from tarballs or file: paths,
 * so they must not expose TypeScript sources. `rewriteRelativeImportExtensions`
 * turns the repo's `.ts` relative specifiers into `.js` in the emitted code.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
const clean = process.argv.includes("--clean");

/**
 * `rewriteRelativeImportExtensions` rewrites JavaScript but not declaration
 * files. A consumer without allowImportingTsExtensions cannot resolve
 * `./foo.ts` from a .d.ts, so declarations get the same rewrite here.
 */
function rewriteDeclarations(dist) {
  for (const file of walk(dist)) {
    if (!file.endsWith(".d.ts")) continue;
    const source = readFileSync(file, "utf8");
    const rewritten = source.replace(/(["'])(\.{1,2}\/[^"']+)\.ts\1/g, (_match, quote, specifier) => `${quote}${specifier}.js${quote}`);
    if (rewritten !== source) writeFileSync(file, rewritten);
  }
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const abs = join(dir, entry);
    return statSync(abs).isDirectory() ? walk(abs) : [abs];
  });
}

const ORDER = [
  "packages/contracts",
  "packages/domain",
  "packages/identity",
  "packages/persistence",
  "packages/adapters",
  "packages/sdk",
  "apps/api",
];

if (!existsSync(tsc)) {
  console.error("[build] typescript not installed. Run npm ci first.");
  process.exit(1);
}

for (const dir of ORDER) {
  const abs = join(root, dir);
  const dist = join(abs, "dist");
  if (clean) {
    rmSync(dist, { recursive: true, force: true });
    console.log(`[build] cleaned ${dir}/dist`);
    continue;
  }
  execFileSync(process.execPath, [tsc, "-p", join(abs, "tsconfig.build.json")], {
    cwd: root,
    stdio: "inherit",
  });
  rewriteDeclarations(dist);
  if (!existsSync(join(dist, "index.js")) && dir !== "apps/api") {
    console.error(`[build] ${dir}/dist/index.js was not emitted`);
    process.exit(1);
  }
  console.log(`[build] ${dir}/dist`);
}

if (clean) process.exit(0);

/** Guard rail: no emitted module may still point at a .ts source file. */
let leaked = 0;
for (const dir of ORDER) {
  const dist = join(root, dir, "dist");
  for (const file of walk(dist)) {
    if (!file.endsWith(".js") && !file.endsWith(".d.ts")) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      if (match[1] && match[1].endsWith(".ts")) {
        console.error(`[build] ${file} still imports ${match[1]}`);
        leaked += 1;
      }
    }
  }
}
if (leaked > 0) {
  console.error(`[build] ${leaked} TypeScript specifier(s) survived emit`);
  process.exit(1);
}
/** Guard rail: the compiler must never leave output next to the sources. */
let stray = 0;
for (const dir of ORDER) {
  for (const file of walk(join(root, dir, "src"))) {
    if (file.endsWith(".js") || file.endsWith(".d.ts")) {
      console.error(`[build] unexpected compiler output next to sources: ${file}`);
      stray += 1;
    }
  }
}
if (stray > 0) {
  console.error(`[build] ${stray} stray file(s) under src/; fix the build config`);
  process.exit(1);
}

console.log(`[build] ${ORDER.length} packages built, no .ts specifiers in dist, no stray output under src`);
