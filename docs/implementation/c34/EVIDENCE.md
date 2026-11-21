# BRD-C34 — evidencia

SHA base: `7de366159bb14a3fd2f8639a443090dbf5f652d8` · generado 2026-11-21T16:18:09.403Z.

## Arquivos

- [`src/adapters/index.ts`](../../../src/adapters/index.ts)

## Gates

| Gate | Estado | Base |
|---|---|---|
| BRD-C34-G01 (invariante de fase) | **NOT_VERIFIED** | requiere proveedor, base de datos aplicada o UI inexistente |
| BRD-C34-G02 (fail-closed cross-tenant/versión) | **NOT_VERIFIED** | no verificable en este entorno |

Un gate `PASS` aquí significa que la regla local se ejecuta y falla en cerrado.
No significa proveedor verificado, base de datos aplicada ni aceptación humana.

## Reproducir

```bash
npm ci && npm run typecheck && npm test && node scripts/check-invariants.ts
```
