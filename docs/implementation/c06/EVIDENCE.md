# BRD-C06 — evidencia

SHA base: `6870a10a5f163fa3a07685f6facdcd6a9e8e7c61` · generado 2026-11-15T15:07:38.312Z.

## Arquivos

- [`src/db/schema.sql`](../../../src/db/schema.sql)
- [`src/db/migrate.ts`](../../../src/db/migrate.ts)
- [`src/db/seed.ts`](../../../src/db/seed.ts)
- [`src/db/seed.sql`](../../../src/db/seed.sql)

## Gates

| Gate | Estado | Base |
|---|---|---|
| BRD-C06-G01 (invariante de fase) | **PASS** | regla implementada y ejercitada por test local |
| BRD-C06-G02 (fail-closed cross-tenant/versión) | **NOT_VERIFIED** | no verificable en este entorno |

Un gate `PASS` aquí significa que la regla local se ejecuta y falla en cerrado.
No significa proveedor verificado, base de datos aplicada ni aceptación humana.

## Reproducir

```bash
npm ci && npm run typecheck && npm test && node scripts/check-invariants.ts
```
