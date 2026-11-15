# BRD-C08 — evidencia

SHA base: `1c78cf14e95c5d69d598a9089ca51472190e81ae` · generado 2026-11-15T15:04:26.989Z.

## Arquivos

- [`src/adapters/index.ts`](../../../src/adapters/index.ts)
- [`FreeBuff/DOPPLER-READY.md`](../../../FreeBuff/DOPPLER-READY.md)

## Gates

| Gate | Estado | Base |
|---|---|---|
| BRD-C08-G01 (invariante de fase) | **PASS** | regla implementada y ejercitada por test local |
| BRD-C08-G02 (fail-closed cross-tenant/versión) | **PASS** | camino de denegación cubierto por la suite |

Un gate `PASS` aquí significa que la regla local se ejecuta y falla en cerrado.
No significa proveedor verificado, base de datos aplicada ni aceptación humana.

## Reproducir

```bash
npm ci && npm run typecheck && npm test && node scripts/check-invariants.ts
```
