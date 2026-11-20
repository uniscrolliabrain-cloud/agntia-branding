# BRD-C06 — evidencia

SHA base: `d0be6c7a7c66ff8e6961474237a8197ab127c5d1` · generado 2026-11-20T14:55:10.407Z.

## Arquivos

- [`src/db/schema.sql`](../../../src/db/schema.sql)
- [`src/db/migrate.ts`](../../../src/db/migrate.ts)
- [`src/db/seed.ts`](../../../src/db/seed.ts)
- [`src/db/seed.sql`](../../../src/db/seed.sql)
- [`test/db-rls.test.ts`](../../../test/db-rls.test.ts)

## Gates

| Gate | Estado | Base |
|---|---|---|
| BRD-C06-G01 (invariante de fase) | **PASS** | regla implementada y ejercitada por test local |
| BRD-C06-G02 (fail-closed cross-tenant/versión) | **PASS** | camino de denegación cubierto por la suite |

Un gate `PASS` aquí significa que la regla local se ejecuta y falla en cerrado.
No significa proveedor verificado, base de datos aplicada ni aceptación humana.

## Reproducir

```bash
npm ci && npm run typecheck && npm test && node scripts/check-invariants.ts
```
