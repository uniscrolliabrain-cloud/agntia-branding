# PREP — Baseline documental de Branding

2026-11-13 · **DOCUMENTATION_ONLY**. El repo ya contenía documentación sustancial pese al tamaño 0 KB informado por el listado de repositorios: README, producto, investigación, referentes, adaptadores, arquitectura, contratos, seguridad, UX, servicio, costes, evaluación, fuentes, manifiesto de 42 campañas/294 tareas/84 gates, release y runbook.

## Fuentes preexistentes
`README.md`; `docs/01-producto.md`–`09-evaluacion.md`; `docs/architecture/01-arquitectura.md`–`04-runtime.md`; `docs/contracts/01-contratos.md`; `docs/campaigns/README.md`, `campaign.json`, `01-*.md`–`42-*.md`; `docs/research/{sources,repositories,parent-source-map}.json`; `docs/release/`; `docs/operations/RUNBOOK.md`.

## Decisión de conservación
No mover ni borrar documentos existentes: su manifiesto y enlaces relativos podrían romperse. Este directorio actúa como índice de baseline. Migración física a `prep/` requerirá snapshot de SHAs, mapa de enlaces, actualización del manifest y comprobación de integridad en commit separado. La nueva capa `docs/factory/` es una adenda; no sustituye evidencia original.

## Hallazgos de alcance
La propuesta original cubre investigación, naming, identidad visual/verbal, design tokens, edición vectorial, QA, derechos y brandbook. Requiere definir fronteras con Diseño (futuro), Marketing, Redes, Vídeo y Ventas, además de contratos de trazabilidad transversales. El repo de Branding es **agencia de branding completa**, no fábrica de logos aislados.

## Limitaciones
Lectura selectiva de documentos de GitHub, no auditoría exhaustiva del código padre ni ejecución de tests. Referencia padre documental `54b8d5407a8576459448c4d059a877297d18ca7a`; reconfirmar antes de integrar. Todo es diseño conceptual, no capacidades existentes.
