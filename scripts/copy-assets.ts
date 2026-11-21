/**
 * Copy the SQL the build needs.
 *
 * `migrate` and `seed` execute the reviewed SQL file, not a string embedded in
 * JavaScript. After `tsc` the file is in dist/db, so the package is self-contained
 * and a tarball install can migrate without the source tree.
 */
import { copyFile, mkdir } from "node:fs/promises";

const SQL = ["schema.sql", "seed.sql"] as const;

await mkdir("dist/db", { recursive: true });
for (const file of SQL) {
  await copyFile(`src/db/${file}`, `dist/db/${file}`);
}
process.stdout.write(`copied ${SQL.length} SQL assets into dist/db\n`);
