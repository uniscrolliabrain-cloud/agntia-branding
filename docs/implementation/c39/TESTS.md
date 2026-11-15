# BRD-C39 — tests

Ejecutados realmente en este commit: `node --test test/` → **88/88 pass, 0 fail**.
Typecheck: `tsc --noEmit` → **0 errores**. Invariantes: `node scripts/check-invariants.ts` → **7/7 PASS**.

## Casos que cubren esta campaña

- SSRF: localhost y direcciones privadas se rechazan
- schema: ninguna política sin predicado de tenant
- la redacción elimina credenciales y contenido

## Lo que estos tests no prueban

- Que un proveedor externo responda como se espera.
- Que las políticas RLS se comporten así en un Postgres real (se verifican estáticamente).
- Que la UI exista, sea accesible o responsive.
