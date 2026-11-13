# Runtime determinista y revisión

LLM interpreta/redacta/propone/explica; código valida identidad, datos, cálculo, estados, límites, autorización y resultado. Política y máquina de estados viven fuera del prompt. Supervisor/visión/juez añaden señales, no permisos. El valor visual no compensa violación de derechos, texto inexacto, SVG ejecutable o pérdida del editable.

## Flujo de trabajo

Intake autenticado o ingreso verificado→binding/tenant/recurso→inbox dedup→staging de fuente→normalización/provenance→propuesta→preview→revisión/aprobación→commit local/outbox→worker revalida→proveedor o artefacto→receipt/unknown→reconciliación→snapshot/reporte/handoff. Cada paso tiene versión, guard y motivos de bloqueo. No completar campos con ficción para evitar mostrar pending.

Estados de dominio propuestos: `brief_draft, researching, concept_proposed, in_design, needs_rights_review, in_review, approved, released, superseded, revoked`. Estado de operación separado: proposed, needs_review, approved, queued, running, accepted, confirmed, failed_definitive, outcome_unknown, reconciliation_required, cancelled. Confirmar aceptación remota no confirma entrega, resultado profesional o satisfacción del cliente. La semántica del efecto se define por módulo.

## Núcleo particular

DesignDocument con nodos/constraints/versiones y fuentes de texto; render determinista por engine/version/font hash. QA geométrica y de texto, contraste calculado donde aplicable, diff de documento y pixel diff con tolerancia declarada. Font fallback no silencioso. ExportManifest liga editable, recursos, licencias y renders.

Los cálculos/validaciones tienen inputs estructurados y fuentes, versiones, units/moneda/fechas, outputs tipados y criterios de admisibilidad. No ejecutar código generado por LLM como parte de un supuesto cálculo determinista. Una aproximación/modelo se etiqueta con supuestos/incertidumbre y revisión, nunca como hecho o autorización. Cumplimiento de constraints de diseño, texto fiel, integridad vectorial, contraste y reproducibilidad de export; no confundir gusto de juez LLM con aceptación o derechos.

## Revisión y efecto

Preview local puro no crea registro remoto, envía mensaje, firma, contrata o gasta. Lectura pagada, generación IA o AV tiene budget/capacidad aparte. ApprovalBinding liga tenant/recurso/actor humano verificado, hash de contenido/alcance/rights/policy, destinatario/canal, versión/coste y expiry/revocación. Cambio material invalida. Un sí hablado prepara propuesta, no firma sensible del piloto. Competencia profesional o representación se comprueba además de auth cuando corresponde.

Intents durable por tenant/capability/idempotencyKey con payloadHash. Replay idéntico devuelve resultado; mismo key con otro payload da409. Commit local de estado/audit/outbox es atómico, HTTP no. Lease/fencing no impiden por sí solos doble efecto remoto. Timeout después de posible aceptación se reconcilia por referencias fiables; si no hay lookup, bloquear/escalar, no intentar otra key/proveedor. No borrar evidencia para parecer rollback.

Workers revalidan principal/mandato/approval, cambios de fuente, suspensión, restricciones y presupuesto antes del efecto. Cursor avanza tras commit. Backoff de lecturas y retries tienen presupuesto; errores clasificados y sanitizados. No fallback admin/default o actividad ficticia cuando un proveedor cae.

## Límite inicial

Sin registrar marca, prometer disponibilidad jurídica, copiar identidad de terceros, publicar/desplegar sin permiso, eliminar originales o usar fuentes/assets sin licencia. Generación IA es propuesta y no certifica autoría/exclusividad.

Nada de cron/SOP empresarial paralelo para simular empleados. Timers técnicos de servicio y jobs de cálculo no sustituyen rota del padre. Handoff offered/acknowledged/working/completed/returned con receptor y prueba de finalización; emitir evento no demuestra recepción. Aprendizaje propone SOP/cambio, pasa replay/no regresión y revisión antes de activarse; nunca aprende secretos de otros clientes.
