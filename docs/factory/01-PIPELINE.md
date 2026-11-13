# Pipeline de cuatro participantes

**Fase actual: diseño conceptual y preparación.** No pedir todavía patchsets ultr granulares, pruebas de código inexistente ni auditorías de implementación.

**ChatGPT / arquitecto:** prepara visión, estructura, léxico, contratos, dependencias, campañas como scaffolds; reconcilia hallazgos. **Founder:** define prioridades, aprueba decisiones, merges y despliegues. **Astra / auditor conceptual independiente:** revisa libremente el diseño cuando el founder lo aporte; no imponer rúbrica prematura ni suponer resultados. **Freebuff:** futuro implementador, writer exclusivo por rama/campaña. **Codex:** futuro verificador independiente del SHA y pruebas. La fábrica operativa tiene tres agentes de ejecución/revisión/dirección + founder; la meta-auditoría Astra es una capa adicional de diseño, no sustitución de Codex.

## Fases
PREP → META_AUDIT_PENDING → META_AUDIT_REVIEWED → ARCHITECTURE_RECONCILED → CAMPAIGNS_GRANULARIZED → READY_PER_CAMPAIGN → IMPLEMENTING → REVIEWING → ARCH_REVIEW → FOUNDER_APPROVAL → MERGED. No afirmar que la meta-auditoría existe antes de recibirla. El fundador puede ajustar el orden.

## Documentos por campaña en la fase posterior
`README.md`, `PATCHSETS.md`, `HANDOFF-FREEBUFF.md`, `HANDOFF-CODEX.md`, `HANDOFF-ARCHITECT-FOUNDER.md`, `ACCEPTANCE.md`; `EVIDENCE.md` y `REVIEW.md` solo cuando existan hechos verificables. Scaffolds actuales NO son handoffs ejecutables.

## Cuando empiece la implementación
Freebuff entrega diff/commits/test results; Codex audita SHA congelado sin editar su rama; arquitecto resuelve contratos; founder autoriza merge. Branch per campaign, superficies de escritura exclusivas, dependencias verificadas, gates bloqueantes, rollback y evidencias reproducibles. No dar PASS a un mock ni prometer tiempo de entrega ficticio.
