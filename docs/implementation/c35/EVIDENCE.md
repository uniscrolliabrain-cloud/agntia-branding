# BRD-C35 — evidencia

SHA base: `133db71b5c8d23b23f9bee98b2b3f853953c0302` · generado 2026-11-20T13:46:48.852Z.

## Arquivos

- [`src/sdk/client.ts`](../../../src/sdk/client.ts)
- [`src/api/app.ts`](../../../src/api/app.ts)
- [`src/contracts/capabilities.ts`](../../../src/contracts/capabilities.ts)

## Gates

| Gate | Estado | Base |
|---|---|---|
| BRD-C35-G01 (invariante de fase) | **PASS** | regla implementada y ejercitada por test local |
| BRD-C35-G02 (fail-closed cross-tenant/versión) | **PASS** | camino de denegación cubierto por la suite |

Un gate `PASS` aquí significa que la regla local se ejecuta y falla en cerrado.
No significa proveedor verificado, base de datos aplicada ni aceptación humana.

## Reproducir

```bash
npm ci && npm run typecheck && npm test && node scripts/check-invariants.ts
```
