# BRD-C06 — tests

Ejecutados realmente en este commit: `node --test test/` → **102/88 pass, 0 fail**.
Typecheck: `tsc --noEmit` → **0 errores**. Invariantes: `node scripts/check-invariants.ts` → **7/7 PASS**.

## Casos que cubren esta campaña

- cada tenant solo ve sus propios briefs con el rol de API
- escribir con el tenant de otro se rechaza por WITH CHECK
- sin tenant en sesión no se ve ninguna fila (fail-closed)
- el worker puede leer pero no borrar historia
- la FK compuesta impide enlazar un documento con datos de otro tenant

## Lo que estos tests no prueban

- Que un proveedor externo responda como se espera.
- Que las políticas RLS se comporten así en un Postgres real (se verifican estáticamente).
- Que la UI exista, sea accesible o responsive.
