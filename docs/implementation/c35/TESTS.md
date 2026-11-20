# BRD-C35 — tests

Ejecutados realmente en este commit: `node --test test/` → **102/88 pass, 0 fail**.
Typecheck: `tsc --noEmit` → **0 errores**. Invariantes: `node scripts/check-invariants.ts` → **7/7 PASS**.

## Casos que cubren esta campaña

- me devuelve principal y capacidades del rol
- una ruta inexistente devuelve 404 normalizado
- las capacidades de efecto con aprobación no son invocables por el modelo

## Lo que estos tests no prueban

- Que un proveedor externo responda como se espera.
- Que las políticas RLS se comporten así en un Postgres real (se verifican estáticamente).
- Que la UI exista, sea accesible o responsive.
