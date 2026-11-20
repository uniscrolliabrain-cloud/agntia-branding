# BRD-C36 — tests

Ejecutados realmente en este commit: `node --test test/` → **95/88 pass, 0 fail**.
Typecheck: `tsc --noEmit` → **0 errores**. Invariantes: `node scripts/check-invariants.ts` → **7/7 PASS**.

## Casos que cubren esta campaña

- no se proyecta un éxito al padre sin receipt
- el outbox deduplica por domainEventId y solo confirma con ACK

## Lo que estos tests no prueban

- Que un proveedor externo responda como se espera.
- Que las políticas RLS se comporten así en un Postgres real (se verifican estáticamente).
- Que la UI exista, sea accesible o responsive.
