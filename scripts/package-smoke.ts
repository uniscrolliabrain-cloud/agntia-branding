/**
 * Package smoke test: prove the tarball is usable by somebody else.
 *
 * `npm run build` passing only proves the repository compiles. This script packs
 * the package, installs the tarball into an empty project and then uses it the
 * way a consumer would: the CLI and an ESM import. If any of that fails, the
 * package is not installable, whatever the source tree looks like.
 *
 * Artifacts stay in .tmp/package-smoke (gitignored) for inspection.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const workdir = join(root, ".tmp", "package-smoke");
const installDir = join(workdir, "install");
const results: string[] = [];

function run(command: string, args: readonly string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false" },
  });
}

function step<T>(name: string, fn: () => T, format?: (value: T) => string): T {
  const value = fn();
  const detail = format ? format(value) : typeof value === "string" ? value : "";
  const line = detail === "" ? `PASS  ${name}` : `PASS  ${name} — ${detail}`;
  results.push(line);
  process.stdout.write(`${line}\n`);
  return value;
}

function main(): void {
  rmSync(workdir, { recursive: true, force: true });
  mkdirSync(installDir, { recursive: true });

  step("build", () => {
    run("npm", ["run", "build"], root);
    for (const file of ["dist/index.js", "dist/index.d.ts", "dist/cli.js", "dist/db/schema.sql"]) {
      if (!existsSync(join(root, file))) throw new Error(`el build no produjo ${file}`);
    }
    return "dist con JS, tipos, bin y SQL";
  });

  const tarball = step(
    "pack",
    () => {
      // `prepack` prints its build output on the same stdout, so the JSON array
      // is located explicitly instead of parsing the whole stream.
      const raw = run("npm", ["pack", "--json", "--pack-destination", workdir], root);
      const start = raw.indexOf("[");
      const end = raw.lastIndexOf("]");
      if (start === -1 || end <= start) throw new Error("npm pack no devolvió metadatos JSON");
      const output = JSON.parse(raw.slice(start, end + 1)) as Array<{ filename: string; size: number }>;
      const packed = output[0];
      if (!packed) throw new Error("npm pack no devolvió metadatos");
      return { path: join(workdir, packed.filename), detail: `${packed.filename} (${packed.size} bytes)` };
    },
    (packed) => packed.detail,
  ).path;

  step("install en un proyecto vacío", () => {
    writeFileSync(
      join(installDir, "package.json"),
      `${JSON.stringify({ name: "agntia-branding-install-smoke", private: true, type: "module" }, null, 2)}\n`,
    );
    run("npm", ["install", "--no-audit", "--no-fund", "--no-package-lock", tarball], installDir);
    const installed = join(installDir, "node_modules", "agntia-branding");
    for (const file of ["dist/cli.js", "dist/index.js", "dist/index.d.ts", "dist/db/schema.sql", "LICENSE"]) {
      if (!existsSync(join(installed, file))) throw new Error(`el tarball no incluye ${file}`);
    }
    return "tarball instalado con tipos, bin y SQL";
  });

  step("CLI instalada: doctor", () => {
    const cli = join(installDir, "node_modules", "agntia-branding", "dist", "cli.js");
    const report = JSON.parse(
      run(process.execPath, [cli, "doctor", "--json"], installDir),
    ) as { ok: boolean; checks: Array<{ name: string; status: string }> };
    if (report.ok !== true) throw new Error("doctor no está OK en el paquete instalado");
    const node = report.checks.find((check) => check.name === "node");
    if (node?.status !== "PASS") throw new Error("doctor no valida Node");
    return "doctor --json responde desde node_modules";
  });

  step("API ESM instalada", () => {
    const code = [
      "const m = await import('agntia-branding');",
      "const required = ['createApp','startServer','loadConfig','resolveActivation','SLICES','validateSliceRegistry','MemoryStore'];",
      "const missing = required.filter((key) => !(key in m));",
      "if (missing.length > 0) { console.error('missing exports: ' + missing.join(',')); process.exit(1); }",
      "if (m.validateSliceRegistry().length > 0) { console.error('invalid slice registry'); process.exit(1); }",
      "console.log(JSON.stringify({ exports: Object.keys(m).length, slices: m.SLICES.length }));",
    ].join("\n");
    const output = JSON.parse(run(process.execPath, ["--input-type=module", "-e", code], installDir)) as {
      exports: number;
      slices: number;
    };
    if (output.slices !== 13) throw new Error(`se esperaban 13 slices, llegaron ${output.slices}`);
    return `${output.exports} exports, ${output.slices} slices, tipos resueltos`;
  });

  process.stdout.write(`\nINSTALLABLE: ${resolve(tarball)}\n`);
  process.stdout.write(`${results.length}/${results.length} comprobaciones de paquete en verde.\n`);
}

try {
  main();
} catch (error) {
  const failure = error as { stderr?: string | Buffer; message?: string };
  process.stderr.write(`FAIL  package smoke — ${failure.message ?? "error"}\n`);
  if (failure.stderr !== undefined && String(failure.stderr).trim() !== "") {
    process.stderr.write(`${String(failure.stderr)}\n`);
  }
  process.exitCode = 1;
}
