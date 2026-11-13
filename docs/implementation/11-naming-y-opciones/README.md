# BRD-C11 — Naming y opciones

**SCAFFOLD CONCEPTUAL, NOT READY.** [Documento original](../../campaigns/11-naming-y-opciones.md). Leer [factory](../../factory/00-README.md), [pipeline](../../factory/01-PIPELINE.md), [léxico](../../factory/02-LEXICO.md), [ADTC](../../factory/03-TRACE-OBSERVABILITY.md), [producto Branding](../../factory/04-PRODUCTO-BRANDING.md) y contexto N−1/N/N+1.

## Objetivo
Construir/verificar naming y opciones para Branding, diseño y sistemas de marca, preservando: Nombre sugerido no está jurídicamente disponible por defecto.

## Contrato conceptual
Operación `brand.naming.propose`; datos `nameCandidate, locale, rationale, uncertainty`; dependencias: BRD-C10; fuentes: H01, S01, S02, P01. Todo PROPOSED/DOC_ONLY hasta cotejar código.

## Invariante
Nombre sugerido no está jurídicamente disponible por defecto

## Tareas existentes (sin granularizar)
- **BRD-C11-T01 — Congelar fuentes, ámbito y autoridad:** Cotejar nameCandidate, locale, rationale, uncertainty con originales, contrato del tenant y versiones de fuente/proveedor. Registrar qué es hecho, declaración, inferencia o desconocido; revisar alcance territorial/temporal y reglas del módulo. **Criterio:** AuthorityMap y fixture explícitos; Nombre sugerido no está jurídicamente disponible por defecto. La ausencia de fuente genera pendiente, no un valor plausible.
- **BRD-C11-T02 — Definir DTO y frontera de datos:** Diseñar esquema runtime para nameCandidate, locale, rationale, uncertainty: tipos, límites, IDs opacos, enums, fechas y versión. Conservar los campos nativos aplicables y declarar nuevos los del servicio. Aislar tenant/proyecto/recurso y minimizar PII. **Criterio:** Round-trip y rechazo de extra/valor inválido; referencias cruzadas no son posibles; source/actor/updatedAt y EvidenceRef preservados donde correspondan.
- **BRD-C11-T03 — Aplicar lógica determinista y revisión:** Implementar o documentar el paso `brand.naming.propose` mediante guards, estados y expectedVersion/CAS. Separar propuesta del modelo de cálculo/decisión verificables. DesignDocument con nodos/constraints/versiones y fuentes de texto; render determinista por engine/version/font hash. QA geométrica y de texto, contraste calculado donde aplicable, diff de documento y pixel diff con tolerancia declarada. Font fallback no silencioso. ExportManifest liga editable, recursos, licencias y renders. **Criterio:** El estado final, el protegido y los motivos de bloqueo son comprobables; Conflicto o significado local dudoso se marca pendiente. No eval/SQL/shell/HTTP genérico del LLM.
- **BRD-C11-T04 — Adaptar con permisos mínimos:** Comprobar versión/edición/ACL de backend si esta fase lo usa; fields/métodos allowlist y binding de servidor. Si es fase local/documental no añadir HTTP. Normalizar errores y limitar IO/tamaño/tiempo/coste de `brand.naming.propose`. **Criterio:** Unknown/unsupported/forbidden no se simulan como éxito; cero HTTP con principal o conexión no autorizados; prueba fake no habilita capability real.
- **BRD-C11-T05 — Vincular autorización y efectos:** Crear preview sin efecto remoto, diff/hash de datos y revisión; identificar quién acepta el resultado y quién puede ejecutar. Si hay efecto, exigir policy/approval/mandato vigentes y un único intent durable con idempotency key. **Criterio:** Cambiar nameCandidate o materialidad del payload invalida la autorización aplicable. Replay igual no duplica; distinto contenido con misma key da conflicto.
- **BRD-C11-T06 — Ejecutar pruebas de negocio y fallo:** Preparar y ejecutar caso específico: Conflicto o significado local dudoso se marca pendiente. Añadir A/B/P, humano/agente/colaborador, revocación, dato sin fuente, cambio concurrente y crash pertinente a `brand.naming.propose`. Verificar ausencia de efectos prohibidos: Un activo sin licencia o texto alterado sale como entregable aprobado, o un SVG malicioso ejecuta código. **Criterio:** El contrato estricto exige resultado correcto y trayectoria segura. Test fallido crítico bloquea; sin entorno se registra NOT_VERIFIED, nunca PASS por un mock.
- **BRD-C11-T07 — Registrar evidencia y cerrar gate:** Guardar SHA/diff, versiones, fixture antes/después, actor/mandato/correlación, fuentes y receipts mínimos. Registrar tests reales y coste/latencia cuando existan. Actualizar riesgos, rollback y siguiente dependencia sin escribir en agente. **Criterio:** EVIDENCE/TESTS/RISKS y decisión de gate revisables; ninguna cifra, firma, actividad o integración inventadas. Mantener fuera del repo público PII, credenciales y originales restringidos.

## Gates diseñados, NO ejecutados
- BRD-C11-G01: Conflicto o significado local dudoso se marca pendiente — Resultado y estado protegido coherentes con invariante, revisión/receipt donde correspondan.
- BRD-C11-G02: Principal/mandato inválido, recurso o conexión de otro tenant, o versión cambiada intenta brand.naming.propose. — Fail-closed antes de leer/actuar remotamente; sin fuga o ampliación de scope, con intento auditado.

## Fase posterior
Completar `PATCHSETS.md`, `HANDOFF-FREEBUFF.md`, `HANDOFF-CODEX.md`, `HANDOFF-ARCHITECT-FOUNDER.md`, `ACCEPTANCE.md` **después de meta-auditoría conceptual**. No afirmar rutas de código existentes ni pruebas realizadas. Rollback de diseño: Deshabilitar capacidad o flag y detener efectos nuevos; conservar audit, links, intents, snapshots y receipts. Restore probado con restricciones/supresiones reaplicadas; no borrar efectos remotos para fingir reversión.
