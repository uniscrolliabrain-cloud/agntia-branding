# BRD-C26 — Composición y edición

**SCAFFOLD CONCEPTUAL, NOT READY.** [Documento original](../../campaigns/26-composicion-y-edicion.md). Leer [factory](../../factory/00-README.md), [pipeline](../../factory/01-PIPELINE.md), [léxico](../../factory/02-LEXICO.md), [ADTC](../../factory/03-TRACE-OBSERVABILITY.md), [producto Branding](../../factory/04-PRODUCTO-BRANDING.md) y contexto N−1/N/N+1.

## Objetivo
Construir/verificar composición y edición para Branding, diseño y sistemas de marca, preservando: Tool no recibe shell/DOM libre o URL arbitraria.

## Contrato conceptual
Operación `brand.design.preview`; datos `operationKey, nodeDiff, expectedVersion, reversiblePatch`; dependencias: BRD-C25; fuentes: H01, S01, S02, P01. Todo PROPOSED/DOC_ONLY hasta cotejar código.

## Invariante
Tool no recibe shell/DOM libre o URL arbitraria

## Tareas existentes (sin granularizar)
- **BRD-C26-T01 — Congelar fuentes, ámbito y autoridad:** Cotejar operationKey, nodeDiff, expectedVersion, reversiblePatch con originales, contrato del tenant y versiones de fuente/proveedor. Registrar qué es hecho, declaración, inferencia o desconocido; revisar alcance territorial/temporal y reglas del módulo. **Criterio:** AuthorityMap y fixture explícitos; Tool no recibe shell/DOM libre o URL arbitraria. La ausencia de fuente genera pendiente, no un valor plausible.
- **BRD-C26-T02 — Definir DTO y frontera de datos:** Diseñar esquema runtime para operationKey, nodeDiff, expectedVersion, reversiblePatch: tipos, límites, IDs opacos, enums, fechas y versión. Conservar los campos nativos aplicables y declarar nuevos los del servicio. Aislar tenant/proyecto/recurso y minimizar PII. **Criterio:** Round-trip y rechazo de extra/valor inválido; referencias cruzadas no son posibles; source/actor/updatedAt y EvidenceRef preservados donde correspondan.
- **BRD-C26-T03 — Aplicar lógica determinista y revisión:** Implementar o documentar el paso `brand.design.preview` mediante guards, estados y expectedVersion/CAS. Separar propuesta del modelo de cálculo/decisión verificables. DesignDocument con nodos/constraints/versiones y fuentes de texto; render determinista por engine/version/font hash. QA geométrica y de texto, contraste calculado donde aplicable, diff de documento y pixel diff con tolerancia declarada. Font fallback no silencioso. ExportManifest liga editable, recursos, licencias y renders. **Criterio:** El estado final, el protegido y los motivos de bloqueo son comprobables; Doble edición conserva original e historial reversible. No eval/SQL/shell/HTTP genérico del LLM.
- **BRD-C26-T04 — Adaptar con permisos mínimos:** Comprobar versión/edición/ACL de backend si esta fase lo usa; fields/métodos allowlist y binding de servidor. Si es fase local/documental no añadir HTTP. Normalizar errores y limitar IO/tamaño/tiempo/coste de `brand.design.preview`. **Criterio:** Unknown/unsupported/forbidden no se simulan como éxito; cero HTTP con principal o conexión no autorizados; prueba fake no habilita capability real.
- **BRD-C26-T05 — Vincular autorización y efectos:** Crear preview sin efecto remoto, diff/hash de datos y revisión; identificar quién acepta el resultado y quién puede ejecutar. Si hay efecto, exigir policy/approval/mandato vigentes y un único intent durable con idempotency key. **Criterio:** Cambiar operationKey o materialidad del payload invalida la autorización aplicable. Replay igual no duplica; distinto contenido con misma key da conflicto.
- **BRD-C26-T06 — Ejecutar pruebas de negocio y fallo:** Preparar y ejecutar caso específico: Doble edición conserva original e historial reversible. Añadir A/B/P, humano/agente/colaborador, revocación, dato sin fuente, cambio concurrente y crash pertinente a `brand.design.preview`. Verificar ausencia de efectos prohibidos: Un activo sin licencia o texto alterado sale como entregable aprobado, o un SVG malicioso ejecuta código. **Criterio:** El contrato estricto exige resultado correcto y trayectoria segura. Test fallido crítico bloquea; sin entorno se registra NOT_VERIFIED, nunca PASS por un mock.
- **BRD-C26-T07 — Registrar evidencia y cerrar gate:** Guardar SHA/diff, versiones, fixture antes/después, actor/mandato/correlación, fuentes y receipts mínimos. Registrar tests reales y coste/latencia cuando existan. Actualizar riesgos, rollback y siguiente dependencia sin escribir en agente. **Criterio:** EVIDENCE/TESTS/RISKS y decisión de gate revisables; ninguna cifra, firma, actividad o integración inventadas. Mantener fuera del repo público PII, credenciales y originales restringidos.

## Gates diseñados, NO ejecutados
- BRD-C26-G01: Doble edición conserva original e historial reversible — Resultado y estado protegido coherentes con invariante, revisión/receipt donde correspondan.
- BRD-C26-G02: Principal/mandato inválido, recurso o conexión de otro tenant, o versión cambiada intenta brand.design.preview. — Fail-closed antes de leer/actuar remotamente; sin fuga o ampliación de scope, con intento auditado.

## Fase posterior
Completar `PATCHSETS.md`, `HANDOFF-FREEBUFF.md`, `HANDOFF-CODEX.md`, `HANDOFF-ARCHITECT-FOUNDER.md`, `ACCEPTANCE.md` **después de meta-auditoría conceptual**. No afirmar rutas de código existentes ni pruebas realizadas. Rollback de diseño: Deshabilitar capacidad o flag y detener efectos nuevos; conservar audit, links, intents, snapshots y receipts. Restore probado con restricciones/supresiones reaplicadas; no borrar efectos remotos para fingir reversión.
