#!/usr/bin/env node
/**
 * Produces installable tarballs for the parent repo in
 * artifacts/parent-install/, plus a manifest with sha256 digests.
 *
 * The tarballs contain only dist/ (and the SQL migration for persistence):
 * no sources, no tests, no env files, no node_modules.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(root, "artifacts", "parent-install");

const PACKAGES = [
  "packages/contracts",
  "packages/domain",
  "packages/identity",
  "packages/persistence",
  "packages/adapters",
  "packages/sdk",
  "apps/api",
];

console.log("[pack] building packages");
execFileSync(process.execPath, [join(root, "scripts", "build-packages.mjs")], {
  cwd: root,
  stdio: "inherit",
});

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const entries = [];
for (const dir of PACKAGES) {
  const abs = join(root, dir);
  const manifest = JSON.parse(readFileSync(join(abs, "package.json"), "utf8"));
  if (manifest.private !== true) {
    console.error(`[pack] ${manifest.name} must stay private: this repo does not publish to a registry`);
    process.exit(1);
  }

  const raw = execFileSync(
    "npm",
    ["pack", "--json", "--pack-destination", outDir, "--ignore-scripts"],
    { cwd: abs, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const packed = JSON.parse(raw.slice(raw.indexOf("[")))[0];
  if (!packed?.filename) {
    console.error(`[pack] npm pack returned no filename for ${manifest.name}`);
    process.exit(1);
  }
  const tarball = join(outDir, packed.filename);
  const files = (packed.files ?? []).map((file) => file.path).sort();

  const unexpected = files.filter(
    (file) => !file.startsWith("dist/") && !file.startsWith("migrations/") && file !== "package.json" && !file.endsWith("README.md") && file !== "LICENSE",
  );
  if (unexpected.length > 0) {
    console.error(`[pack] ${manifest.name} tarball contains non-public files: ${unexpected.join(", ")}`);
    process.exit(1);
  }
  if (!files.some((file) => file.startsWith("dist/"))) {
    console.error(`[pack] ${manifest.name} tarball has no dist/ output`);
    process.exit(1);
  }

  const bytes = statSync(tarball).size;
  const sha256 = createHash("sha256").update(readFileSync(tarball)).digest("hex");
  entries.push({ name: manifest.name, version: manifest.version, tarball: packed.filename, bytes, sha256, files });
  console.log(`[pack] ${manifest.name}@${manifest.version} -> ${packed.filename} (${files.length} files, ${bytes} bytes)`);
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  note: "Tarballs install with npm file: specs. They are build artifacts, not releases: no registry publication.",
  packages: entries,
};
writeFileSync(join(outDir, "parent-install.json"), `${JSON.stringify(snapshot, null, 2)}\n`);

const listed = readdirSync(outDir).filter((file) => file.endsWith(".tgz"));
if (listed.length !== entries.length) {
  console.error(`[pack] expected ${entries.length} tarballs, found ${listed.length}`);
  process.exit(1);
}
console.log(`[pack] ${entries.length} tarballs + parent-install.json in artifacts/parent-install`);
