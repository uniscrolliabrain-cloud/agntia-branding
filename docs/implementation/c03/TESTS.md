# BRD-C03 — tests

Ejecutados realmente en este commit: `node --test test/` → **133/133 pass, 0 fail**.
Typecheck: `tsc --noEmit` → **0 errores**. Invariantes: `node scripts/check-invariants.ts` → **7/7 PASS**.

## Casos que cubren esta campaña

- firma inválida se rechaza
- JWT válido sin membresía provisionada no autoriza
- token de otro tenant no reutiliza la membresía propia

## Lo que estos tests no prueban

- Que un proveedor externo responda como se espera.
- Que las políticas RLS se comporten así en un Postgres real (se verifican estáticamente).
- Que la UI exista, sea accesible o responsive.
