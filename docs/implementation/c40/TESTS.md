# BRD-C40 — tests

Ejecutados realmente en este commit: `node --test test/` → **133/133 pass, 0 fail**.
Typecheck: `tsc --noEmit` → **0 errores**. Invariantes: `node scripts/check-invariants.ts` → **7/7 PASS**.

## Casos que cubren esta campaña

- vertical completo: brief → identidad → tokens → diseño → QA → export → entrega
- un activo de otro tenant no puede sostener un export del tenant A

## Lo que estos tests no prueban

- Que un proveedor externo responda como se espera.
- Que las políticas RLS se comporten así en un Postgres real (se verifican estáticamente).
- Que la UI exista, sea accesible o responsive.
