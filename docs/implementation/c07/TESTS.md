# BRD-C07 — tests

Ejecutados realmente en este commit: `node --test test/` → **108/88 pass, 0 fail**.
Typecheck: `tsc --noEmit` → **0 errores**. Invariantes: `node scripts/check-invariants.ts` → **7/7 PASS**.

## Casos que cubren esta campaña

- cambiar el contenido invalida la aprobación
- el proponente no puede aprobar su propio efecto
- PEP exige aprobación para exportar tokens

## Lo que estos tests no prueban

- Que un proveedor externo responda como se espera.
- Que las políticas RLS se comporten así en un Postgres real (se verifican estáticamente).
- Que la UI exista, sea accesible o responsive.
