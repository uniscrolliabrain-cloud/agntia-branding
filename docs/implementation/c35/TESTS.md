# BRD-C35 — tests

Ejecutados realmente en este commit: `node --test test/` → **133/133 pass, 0 fail**.
Typecheck: `tsc --noEmit` → **0 errores**. Invariantes: `node scripts/check-invariants.ts` → **7/7 PASS**.

## Casos que cubren esta campaña

- me devuelve principal y capacidades del rol
- una ruta inexistente devuelve 404 normalizado
- las capacidades de efecto con aprobación no son invocables por el modelo
- el servidor Node habla el contrato Fetch: health, 401 y 404
- slices y capabilities muestran qué está apagado y por qué

## Lo que estos tests no prueban

- Que un proveedor externo responda como se espera.
- Que las políticas RLS se comporten así en un Postgres real (se verifican estáticamente).
- Que la UI exista, sea accesible o responsive.
