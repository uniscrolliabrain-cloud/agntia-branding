# BRD-C30 — tests

Ejecutados realmente en este commit: `node --test test/` → **95/88 pass, 0 fail**.
Typecheck: `tsc --noEmit` → **0 errores**. Invariantes: `node scripts/check-invariants.ts` → **7/7 PASS**.

## Casos que cubren esta campaña

- preflight produce manifiesto ligado a documento, fuente y derechos
- preflight rechaza PDF por debajo de 300 dpi

## Lo que estos tests no prueban

- Que un proveedor externo responda como se espera.
- Que las políticas RLS se comporten así en un Postgres real (se verifican estáticamente).
- Que la UI exista, sea accesible o responsive.
