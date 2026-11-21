# BRD-C41 — evidencia

SHA base: `7de366159bb14a3fd2f8639a443090dbf5f652d8` · generado 2026-11-21T16:18:09.403Z.

## Arquivos

- [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)
- [`src/db/migrate.ts`](../../../src/db/migrate.ts)
- [`src/db/seed.ts`](../../../src/db/seed.ts)
- [`scripts/package-smoke.ts`](../../../scripts/package-smoke.ts)
- [`tsconfig.build.json`](../../../tsconfig.build.json)
- [`LICENSE`](../../../LICENSE)
- [`.gitignore`](../../../.gitignore)

## Gates

| Gate | Estado | Base |
|---|---|---|
| BRD-C41-G01 (invariante de fase) | **PASS** | regla implementada y ejercitada por test local |
| BRD-C41-G02 (fail-closed cross-tenant/versión) | **NOT_VERIFIED** | no verificable en este entorno |

Un gate `PASS` aquí significa que la regla local se ejecuta y falla en cerrado.
No significa proveedor verificado, base de datos aplicada ni aceptación humana.

## Reproducir

```bash
npm ci && npm run typecheck && npm test && node scripts/check-invariants.ts
```
