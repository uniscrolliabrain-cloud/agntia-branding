# BRD-C19 — Canvas Fabric/SVG

**DESIGN_ONLY / NOT_STARTED / 19 de 42.** [Campaña original](../../campaigns/19-canvas-fabric-svg.md).

## Objetivo y autoridad
Construir/verificar canvas fabric/svg para Branding, diseño y sistemas de marca, preservando: SVG/XML no ejecutables ni URLs externas arbitrarias.

**Operación:** `brand.canvas.preview`. **Campos:** nodeSchema, safeAttributes, imageRefs, renderVersion. **Invariante:** SVG/XML no ejecutables ni URLs externas arbitrarias. **Depende de:** BRD-C18.

## Superficies de código propuestas (verificar checkout)
- Dominio principal: `packages/adapters/src/penpot.ts`.
- DTO/Schema: `packages/contracts/src/19.ts` solo si necesario.
- API: `apps/api/src/routes/19.ts` solo con capability autorizada.
- Tests: `tests/campaigns/019.test.ts`, fixtures `tests/fixtures/019/`.
- Evidencia: `docs/implementation/c19/EVIDENCE.md` y reporte dentro de este documento.
- Artefactos originales: `docs/implementation/c19/README.md`, `docs/implementation/c19/EVIDENCE.md`, `docs/implementation/c19/TESTS.md`, `docs/implementation/c19/RISKS.md`. No asumir que existen rutas de producto en main.

## Patchsets secuenciales
### 019.01 — BRD-C19-T01: Congelar fuentes, ámbito y autoridad

**Acción:** Cotejar nodeSchema, safeAttributes, imageRefs, renderVersion con originales, contrato del tenant y versiones de fuente/proveedor. Registrar qué es hecho, declaración, inferencia o desconocido; revisar alcance territorial/temporal y reglas del módulo.

**Archivo primario:** `packages/adapters/src/penpot.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** AuthorityMap y fixture explícitos; SVG/XML no ejecutables ni URLs externas arbitrarias. La ausencia de fuente genera pendiente, no un valor plausible.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** inicio.

### 019.02 — BRD-C19-T02: Definir DTO y frontera de datos

**Acción:** Diseñar esquema runtime para nodeSchema, safeAttributes, imageRefs, renderVersion: tipos, límites, IDs opacos, enums, fechas y versión. Conservar los campos nativos aplicables y declarar nuevos los del servicio. Aislar tenant/proyecto/recurso y minimizar PII.

**Archivo primario:** `packages/adapters/src/penpot.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** Round-trip y rechazo de extra/valor inválido; referencias cruzadas no son posibles; source/actor/updatedAt y EvidenceRef preservados donde correspondan.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C19-T01.

### 019.03 — BRD-C19-T03: Aplicar lógica determinista y revisión

**Acción:** Implementar o documentar el paso `brand.canvas.preview` mediante guards, estados y expectedVersion/CAS. Separar propuesta del modelo de cálculo/decisión verificables. DesignDocument con nodos/constraints/versiones y fuentes de texto; render determinista por engine/version/font hash. QA geométrica y de texto, contraste calculado donde aplicable, diff de documento y pixel diff con tolerancia declarada. Font fallback no silencioso. ExportManifest liga editable, recursos, licencias y renders.

**Archivo primario:** `packages/adapters/src/penpot.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** El estado final, el protegido y los motivos de bloqueo son comprobables; Script/event handler/data URL malicioso se rechaza. No eval/SQL/shell/HTTP genérico del LLM.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C19-T02.

### 019.04 — BRD-C19-T04: Adaptar con permisos mínimos

**Acción:** Comprobar versión/edición/ACL de backend si esta fase lo usa; fields/métodos allowlist y binding de servidor. Si es fase local/documental no añadir HTTP. Normalizar errores y limitar IO/tamaño/tiempo/coste de `brand.canvas.preview`.

**Archivo primario:** `packages/adapters/src/penpot.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** Unknown/unsupported/forbidden no se simulan como éxito; cero HTTP con principal o conexión no autorizados; prueba fake no habilita capability real.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C19-T03.

### 019.05 — BRD-C19-T05: Vincular autorización y efectos

**Acción:** Crear preview sin efecto remoto, diff/hash de datos y revisión; identificar quién acepta el resultado y quién puede ejecutar. Si hay efecto, exigir policy/approval/mandato vigentes y un único intent durable con idempotency key.

**Archivo primario:** `packages/adapters/src/penpot.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** Cambiar nodeSchema o materialidad del payload invalida la autorización aplicable. Replay igual no duplica; distinto contenido con misma key da conflicto.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C19-T04.

### 019.06 — BRD-C19-T06: Ejecutar pruebas de negocio y fallo

**Acción:** Preparar y ejecutar caso específico: Script/event handler/data URL malicioso se rechaza. Añadir A/B/P, humano/agente/colaborador, revocación, dato sin fuente, cambio concurrente y crash pertinente a `brand.canvas.preview`. Verificar ausencia de efectos prohibidos: Un activo sin licencia o texto alterado sale como entregable aprobado, o un SVG malicioso ejecuta código.

**Archivo primario:** `packages/adapters/src/penpot.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** El contrato estricto exige resultado correcto y trayectoria segura. Test fallido crítico bloquea; sin entorno se registra NOT_VERIFIED, nunca PASS por un mock.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C19-T05.

### 019.07 — BRD-C19-T07: Registrar evidencia y cerrar gate

**Acción:** Guardar SHA/diff, versiones, fixture antes/después, actor/mandato/correlación, fuentes y receipts mínimos. Registrar tests reales y coste/latencia cuando existan. Actualizar riesgos, rollback y siguiente dependencia sin escribir en agente.

**Archivo primario:** `packages/adapters/src/penpot.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** EVIDENCE/TESTS/RISKS y decisión de gate revisables; ninguna cifra, firma, actividad o integración inventadas. Mantener fuera del repo público PII, credenciales y originales restringidos.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C19-T06.


## Wiring transversal
JWT Supabase+membresía → ACL recurso/campo y mandato de twin → Zod DTO → AuthorityMap/policy → versión/aprobación → Postgres RLS+audit+outbox → worker scoped → adaptador tipado → receipt/entrega → bridge padre. Artefactos de diseño deben conservar fuentes, versiones, licencias, atribución y derechos; logos/naming sin promesa de clearance legal definitivo. Export editable y reproducible. Anam solo presencia, no autorización.

## Gates de aceptación
- **BRD-C19-G01 / NOT_EXECUTED:** Script/event handler/data URL malicioso se rechaza. Esperado: Resultado y estado protegido coherentes con invariante, revisión/receipt donde correspondan.
- **BRD-C19-G02 / NOT_EXECUTED:** Principal/mandato inválido, recurso o conexión de otro tenant, o versión cambiada intenta brand.canvas.preview.. Esperado: Fail-closed antes de leer/actuar remotamente; sin fuga o ampliación de scope, con intento auditado.

**Bloqueos:** Cross-tenant o secretos expuestos; Approval/mandato/scope ampliados sin autorización; Pérdida de historia o duplicación tras timeout; Conclusión sensible sin fuentes/revisión competente.

**Rollback:** Deshabilitar capacidad o flag y detener efectos nuevos; conservar audit, links, intents, snapshots y receipts. Restore probado con restricciones/supresiones reaplicadas; no borrar efectos remotos para fingir reversión.

## Reporte Freebuff — completar tras ejecutar
Estado: PENDING. SHA: PENDING. Archivos/diff: PENDING. Tests y fixtures: PENDING. Gates: PENDING. Decisiones/incoherencias: PENDING. Deuda y riesgos: PENDING. Aprendizajes para mejorar el programa: PENDING. **Continuar siguiente campaña sin esperar auditoría Codex.**
