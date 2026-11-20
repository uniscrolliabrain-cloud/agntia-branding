# BRD-C30 — tests

Ejecutados realmente en este commit: `node --test test/` → **108/88 pass, 0 fail**.
Typecheck: `tsc --noEmit` → **0 errores**. Invariantes: `node scripts/check-invariants.ts` → **7/7 PASS**.

## Casos que cubren esta campaña

- preflight produce manifiesto ligado a documento, fuente y derechos
- preflight rechaza PDF por debajo de 300 dpi
- render PNG produce bytes reales y exige aceptar la sustitución de tipografía
- render PDF es estructuralmente válido: xref apunta a cada objeto
- render SVG entrega vector con el texto escapado y sin sustituciones
- el render falla cerrado ante lo que no puede dibujar con verdad
- el render se ata al manifiesto: versión distinta o documento editado no producen bytes

## Lo que estos tests no prueban

- Que un proveedor externo responda como se espera.
- Que las políticas RLS se comporten así en un Postgres real (se verifican estáticamente).
- Que la UI exista, sea accesible o responsive.
