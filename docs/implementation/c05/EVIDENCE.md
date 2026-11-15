# BRD-C05 — evidencia

SHA base: `6870a10a5f163fa3a07685f6facdcd6a9e8e7c61` · generado 2026-11-15T15:07:38.312Z.

## Arquivos

- [`src/contracts/errors.ts`](../../../src/contracts/errors.ts)
- [`src/contracts/envelope.ts`](../../../src/contracts/envelope.ts)
- [`src/contracts/evidence.ts`](../../../src/contracts/evidence.ts)

## Gates

| Gate | Estado | Base |
|---|---|---|
| BRD-C05-G01 (invariante de fase) | **PASS** | regla implementada y ejercitada por test local |
| BRD-C05-G02 (fail-closed cross-tenant/versión) | **PASS** | camino de denegación cubierto por la suite |

Un gate `PASS` aquí significa que la regla local se ejecuta y falla en cerrado.
No significa proveedor verificado, base de datos aplicada ni aceptación humana.

## Reproducir

```bash
npm ci && npm run typecheck && npm test && node scripts/check-invariants.ts
```
