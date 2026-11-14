# BRD-C40 — Vertical E2E y fallos distribuidos

**DESIGN_ONLY / NOT_STARTED / 40 de 42.** [Campaña original](../../campaigns/40-vertical-e2e-y-fallos-distribuidos.md).

## Objetivo y autoridad
Construir/verificar vertical e2e y fallos distribuidos para Branding, diseño y sistemas de marca, preservando: Mock no acredita proveedor real; respuesta correcta no compensa acción prohibida.

**Operación:** `e2e.verify`. **Campos:** fixtureA/B/P, stateBeforeAfter, receipt, replay, revocation. **Invariante:** Mock no acredita proveedor real; respuesta correcta no compensa acción prohibida. **Depende de:** BRD-C39.

## Superficies de código propuestas (verificar checkout)
- Dominio principal: `packages/security/src/privacy.ts`.
- DTO/Schema: `packages/contracts/src/40.ts` solo si necesario.
- API: `apps/api/src/routes/40.ts` solo con capability autorizada.
- Tests: `tests/campaigns/040.test.ts`, fixtures `tests/fixtures/040/`.
- Evidencia: `docs/implementation/c40/EVIDENCE.md` y reporte dentro de este documento.
- Artefactos originales: `docs/implementation/c40/README.md`, `docs/implementation/c40/EVIDENCE.md`, `docs/implementation/c40/TESTS.md`, `docs/implementation/c40/RISKS.md`. No asumir que existen rutas de producto en main.

## Patchsets secuenciales
### 040.01 — BRD-C40-T01: Congelar fuentes, ámbito y autoridad

**Acción:** Cotejar fixtureA/B/P, stateBeforeAfter, receipt, replay, revocation con originales, contrato del tenant y versiones de fuente/proveedor. Registrar qué es hecho, declaración, inferencia o desconocido; revisar alcance territorial/temporal y reglas del módulo.

**Archivo primario:** `packages/security/src/privacy.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** AuthorityMap y fixture explícitos; Mock no acredita proveedor real; respuesta correcta no compensa acción prohibida. La ausencia de fuente genera pendiente, no un valor plausible.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** inicio.

### 040.02 — BRD-C40-T02: Definir DTO y frontera de datos

**Acción:** Diseñar esquema runtime para fixtureA/B/P, stateBeforeAfter, receipt, replay, revocation: tipos, límites, IDs opacos, enums, fechas y versión. Conservar los campos nativos aplicables y declarar nuevos los del servicio. Aislar tenant/proyecto/recurso y minimizar PII.

**Archivo primario:** `packages/security/src/privacy.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** Round-trip y rechazo de extra/valor inválido; referencias cruzadas no son posibles; source/actor/updatedAt y EvidenceRef preservados donde correspondan.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C40-T01.

### 040.03 — BRD-C40-T03: Aplicar lógica determinista y revisión

**Acción:** Implementar o documentar el paso `e2e.verify` mediante guards, estados y expectedVersion/CAS. Separar propuesta del modelo de cálculo/decisión verificables. DesignDocument con nodos/constraints/versiones y fuentes de texto; render determinista por engine/version/font hash. QA geométrica y de texto, contraste calculado donde aplicable, diff de documento y pixel diff con tolerancia declarada. Font fallback no silencioso. ExportManifest liga editable, recursos, licencias y renders.

**Archivo primario:** `packages/security/src/privacy.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** El estado final, el protegido y los motivos de bloqueo son comprobables; Timeout tras aceptación no duplica tras takeover/retry. No eval/SQL/shell/HTTP genérico del LLM.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C40-T02.

### 040.04 — BRD-C40-T04: Adaptar con permisos mínimos

**Acción:** Comprobar versión/edición/ACL de backend si esta fase lo usa; fields/métodos allowlist y binding de servidor. Si es fase local/documental no añadir HTTP. Normalizar errores y limitar IO/tamaño/tiempo/coste de `e2e.verify`.

**Archivo primario:** `packages/security/src/privacy.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** Unknown/unsupported/forbidden no se simulan como éxito; cero HTTP con principal o conexión no autorizados; prueba fake no habilita capability real.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C40-T03.

### 040.05 — BRD-C40-T05: Vincular autorización y efectos

**Acción:** Crear preview sin efecto remoto, diff/hash de datos y revisión; identificar quién acepta el resultado y quién puede ejecutar. Si hay efecto, exigir policy/approval/mandato vigentes y un único intent durable con idempotency key.

**Archivo primario:** `packages/security/src/privacy.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** Cambiar fixtureA/B/P o materialidad del payload invalida la autorización aplicable. Replay igual no duplica; distinto contenido con misma key da conflicto.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C40-T04.

### 040.06 — BRD-C40-T06: Ejecutar pruebas de negocio y fallo

**Acción:** Preparar y ejecutar caso específico: Timeout tras aceptación no duplica tras takeover/retry. Añadir A/B/P, humano/agente/colaborador, revocación, dato sin fuente, cambio concurrente y crash pertinente a `e2e.verify`. Verificar ausencia de efectos prohibidos: Un activo sin licencia o texto alterado sale como entregable aprobado, o un SVG malicioso ejecuta código.

**Archivo primario:** `packages/security/src/privacy.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** El contrato estricto exige resultado correcto y trayectoria segura. Test fallido crítico bloquea; sin entorno se registra NOT_VERIFIED, nunca PASS por un mock.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C40-T05.

### 040.07 — BRD-C40-T07: Registrar evidencia y cerrar gate

**Acción:** Guardar SHA/diff, versiones, fixture antes/después, actor/mandato/correlación, fuentes y receipts mínimos. Registrar tests reales y coste/latencia cuando existan. Actualizar riesgos, rollback y siguiente dependencia sin escribir en agente.

**Archivo primario:** `packages/security/src/privacy.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** EVIDENCE/TESTS/RISKS y decisión de gate revisables; ninguna cifra, firma, actividad o integración inventadas. Mantener fuera del repo público PII, credenciales y originales restringidos.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C40-T06.


## Wiring transversal
JWT Supabase+membresía → ACL recurso/campo y mandato de twin → Zod DTO → AuthorityMap/policy → versión/aprobación → Postgres RLS+audit+outbox → worker scoped → adaptador tipado → receipt/entrega → bridge padre. Artefactos de diseño deben conservar fuentes, versiones, licencias, atribución y derechos; logos/naming sin promesa de clearance legal definitivo. Export editable y reproducible. Anam solo presencia, no autorización.

## Gates de aceptación
- **BRD-C40-G01 / NOT_EXECUTED:** Timeout tras aceptación no duplica tras takeover/retry. Esperado: Resultado y estado protegido coherentes con invariante, revisión/receipt donde correspondan.
- **BRD-C40-G02 / NOT_EXECUTED:** Principal/mandato inválido, recurso o conexión de otro tenant, o versión cambiada intenta e2e.verify.. Esperado: Fail-closed antes de leer/actuar remotamente; sin fuga o ampliación de scope, con intento auditado.

**Bloqueos:** Cross-tenant o secretos expuestos; Approval/mandato/scope ampliados sin autorización; Pérdida de historia o duplicación tras timeout; Conclusión sensible sin fuentes/revisión competente.

**Rollback:** Deshabilitar capacidad o flag y detener efectos nuevos; conservar audit, links, intents, snapshots y receipts. Restore probado con restricciones/supresiones reaplicadas; no borrar efectos remotos para fingir reversión.

## Reporte Freebuff — completar tras ejecutar
Estado: PENDING. SHA: PENDING. Archivos/diff: PENDING. Tests y fixtures: PENDING. Gates: PENDING. Decisiones/incoherencias: PENDING. Deuda y riesgos: PENDING. Aprendizajes para mejorar el programa: PENDING. **Continuar siguiente campaña sin esperar auditoría Codex.**
