# BRD-C34 — evidencia

SHA base: `d0be6c7a7c66ff8e6961474237a8197ab127c5d1` · generado 2026-11-20T14:55:10.407Z.

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
