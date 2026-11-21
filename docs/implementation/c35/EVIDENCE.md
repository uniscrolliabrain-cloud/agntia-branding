# BRD-C35 — evidencia

SHA base: `7de366159bb14a3fd2f8639a443090dbf5f652d8` · generado 2026-11-21T16:18:09.403Z.

## Arquivos

- [`src/sdk/client.ts`](../../../src/sdk/client.ts)
- [`src/api/app.ts`](../../../src/api/app.ts)
- [`src/contracts/capabilities.ts`](../../../src/contracts/capabilities.ts)
- [`src/cli.ts`](../../../src/cli.ts)
- [`src/server.ts`](../../../src/server.ts)

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
