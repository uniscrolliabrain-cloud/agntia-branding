# BRD-C11 — Naming y opciones

**DESIGN_ONLY / NOT_STARTED / 11 de 42.** [Campaña original](../../campaigns/11-naming-y-opciones.md).

## Objetivo y autoridad
Construir/verificar naming y opciones para Branding, diseño y sistemas de marca, preservando: Nombre sugerido no está jurídicamente disponible por defecto.

**Operación:** `brand.naming.propose`. **Campos:** nameCandidate, locale, rationale, uncertainty. **Invariante:** Nombre sugerido no está jurídicamente disponible por defecto. **Depende de:** BRD-C10.

## Superficies de código propuestas (verificar checkout)
- Dominio principal: `packages/domain/src/naming.ts`.
- DTO/Schema: `packages/contracts/src/11.ts` solo si necesario.
- API: `apps/api/src/routes/11.ts` solo con capability autorizada.
- Tests: `tests/campaigns/011.test.ts`, fixtures `tests/fixtures/011/`.
- Evidencia: `docs/implementation/c11/EVIDENCE.md` y reporte dentro de este documento.
- Artefactos originales: `docs/implementation/c11/README.md`, `docs/implementation/c11/EVIDENCE.md`, `docs/implementation/c11/TESTS.md`, `docs/implementation/c11/RISKS.md`. No asumir que existen rutas de producto en main.

## Patchsets secuenciales
### 011.01 — BRD-C11-T01: Congelar fuentes, ámbito y autoridad

**Acción:** Cotejar nameCandidate, locale, rationale, uncertainty con originales, contrato del tenant y versiones de fuente/proveedor. Registrar qué es hecho, declaración, inferencia o desconocido; revisar alcance territorial/temporal y reglas del módulo.

**Archivo primario:** `packages/domain/src/naming.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** AuthorityMap y fixture explícitos; Nombre sugerido no está jurídicamente disponible por defecto. La ausencia de fuente genera pendiente, no un valor plausible.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** inicio.

### 011.02 — BRD-C11-T02: Definir DTO y frontera de datos

**Acción:** Diseñar esquema runtime para nameCandidate, locale, rationale, uncertainty: tipos, límites, IDs opacos, enums, fechas y versión. Conservar los campos nativos aplicables y declarar nuevos los del servicio. Aislar tenant/proyecto/recurso y minimizar PII.

**Archivo primario:** `packages/domain/src/naming.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** Round-trip y rechazo de extra/valor inválido; referencias cruzadas no son posibles; source/actor/updatedAt y EvidenceRef preservados donde correspondan.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C11-T01.

### 011.03 — BRD-C11-T03: Aplicar lógica determinista y revisión

**Acción:** Implementar o documentar el paso `brand.naming.propose` mediante guards, estados y expectedVersion/CAS. Separar propuesta del modelo de cálculo/decisión verificables. DesignDocument con nodos/constraints/versiones y fuentes de texto; render determinista por engine/version/font hash. QA geométrica y de texto, contraste calculado donde aplicable, diff de documento y pixel diff con tolerancia declarada. Font fallback no silencioso. ExportManifest liga editable, recursos, licencias y renders.

**Archivo primario:** `packages/domain/src/naming.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** El estado final, el protegido y los motivos de bloqueo son comprobables; Conflicto o significado local dudoso se marca pendiente. No eval/SQL/shell/HTTP genérico del LLM.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C11-T02.

### 011.04 — BRD-C11-T04: Adaptar con permisos mínimos

**Acción:** Comprobar versión/edición/ACL de backend si esta fase lo usa; fields/métodos allowlist y binding de servidor. Si es fase local/documental no añadir HTTP. Normalizar errores y limitar IO/tamaño/tiempo/coste de `brand.naming.propose`.

**Archivo primario:** `packages/domain/src/naming.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** Unknown/unsupported/forbidden no se simulan como éxito; cero HTTP con principal o conexión no autorizados; prueba fake no habilita capability real.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C11-T03.

### 011.05 — BRD-C11-T05: Vincular autorización y efectos

**Acción:** Crear preview sin efecto remoto, diff/hash de datos y revisión; identificar quién acepta el resultado y quién puede ejecutar. Si hay efecto, exigir policy/approval/mandato vigentes y un único intent durable con idempotency key.

**Archivo primario:** `packages/domain/src/naming.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** Cambiar nameCandidate o materialidad del payload invalida la autorización aplicable. Replay igual no duplica; distinto contenido con misma key da conflicto.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C11-T04.

### 011.06 — BRD-C11-T06: Ejecutar pruebas de negocio y fallo

**Acción:** Preparar y ejecutar caso específico: Conflicto o significado local dudoso se marca pendiente. Añadir A/B/P, humano/agente/colaborador, revocación, dato sin fuente, cambio concurrente y crash pertinente a `brand.naming.propose`. Verificar ausencia de efectos prohibidos: Un activo sin licencia o texto alterado sale como entregable aprobado, o un SVG malicioso ejecuta código.

**Archivo primario:** `packages/domain/src/naming.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** El contrato estricto exige resultado correcto y trayectoria segura. Test fallido crítico bloquea; sin entorno se registra NOT_VERIFIED, nunca PASS por un mock.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C11-T05.

### 011.07 — BRD-C11-T07: Registrar evidencia y cerrar gate

**Acción:** Guardar SHA/diff, versiones, fixture antes/después, actor/mandato/correlación, fuentes y receipts mínimos. Registrar tests reales y coste/latencia cuando existan. Actualizar riesgos, rollback y siguiente dependencia sin escribir en agente.

**Archivo primario:** `packages/domain/src/naming.ts`; verificar imports, ownership y contratos. Separar dominio, adaptador, schema y tests cuando aplique. Si tarea es documental, generar evidencia verificable, no endpoint inventado.

**Aceptación:** EVIDENCE/TESTS/RISKS y decisión de gate revisables; ninguna cifra, firma, actividad o integración inventadas. Mantener fuera del repo público PII, credenciales y originales restringidos.

**Test y evidencia:** caso positivo, tenant ajeno, permiso insuficiente, input inválido y fallo de proveedor/rollback cuando aplique; comando, SHA, fixture, resultado. **Depende de:** BRD-C11-T06.


## Wiring transversal
JWT Supabase+membresía → ACL recurso/campo y mandato de twin → Zod DTO → AuthorityMap/policy → versión/aprobación → Postgres RLS+audit+outbox → worker scoped → adaptador tipado → receipt/entrega → bridge padre. Artefactos de diseño deben conservar fuentes, versiones, licencias, atribución y derechos; logos/naming sin promesa de clearance legal definitivo. Export editable y reproducible. Anam solo presencia, no autorización.

## Gates de aceptación
- **BRD-C11-G01 / NOT_EXECUTED:** Conflicto o significado local dudoso se marca pendiente. Esperado: Resultado y estado protegido coherentes con invariante, revisión/receipt donde correspondan.
- **BRD-C11-G02 / NOT_EXECUTED:** Principal/mandato inválido, recurso o conexión de otro tenant, o versión cambiada intenta brand.naming.propose.. Esperado: Fail-closed antes de leer/actuar remotamente; sin fuga o ampliación de scope, con intento auditado.

**Bloqueos:** Cross-tenant o secretos expuestos; Approval/mandato/scope ampliados sin autorización; Pérdida de historia o duplicación tras timeout; Conclusión sensible sin fuentes/revisión competente.

**Rollback:** Deshabilitar capacidad o flag y detener efectos nuevos; conservar audit, links, intents, snapshots y receipts. Restore probado con restricciones/supresiones reaplicadas; no borrar efectos remotos para fingir reversión.

## Reporte Freebuff — completar tras ejecutar
Estado: PENDING. SHA: PENDING. Archivos/diff: PENDING. Tests y fixtures: PENDING. Gates: PENDING. Decisiones/incoherencias: PENDING. Deuda y riesgos: PENDING. Aprendizajes para mejorar el programa: PENDING. **Continuar siguiente campaña sin esperar auditoría Codex.**
