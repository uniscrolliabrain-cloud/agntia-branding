# BRD-C34 — tests

Ejecutados realmente en este commit: `node --test test/` → **88/88 pass, 0 fail**.
Typecheck: `tsc --noEmit` → **0 errores**. Invariantes: `node scripts/check-invariants.ts` → **7/7 PASS**.

## Casos que cubren esta campaña

_Ninguno: la campaña no está implementada, así que no hay test que la cubra. No se escribieron tests espejo para aparentar cobertura._

## Lo que estos tests no prueban

- Que un proveedor externo responda como se espera.
- Que las políticas RLS se comporten así en un Postgres real (se verifican estáticamente).
- Que la UI exista, sea accesible o responsive.
- Nada de la campaña: no hay implementación.
