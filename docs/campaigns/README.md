# Campaña de42 fases

Diseño para una implementación futura autorizada. **42 campañas,294 tareas,84 escenarios, NOT_STARTED/NOT_EXECUTED.** No plazo ficticio de siete días. No modificar agente. Fuentes/contratos no equivalen a capacidades probadas.

[Manifest estructurado](campaign.json): IDs/dependencias, campos, operaciones, invariantes, tareas/aceptación, gates, bloqueos y rollback. Rutas de artefactos son propuestas, no archivos existentes.

C01–C08 fundaciones; C09–C32 dominio; C33–C42 exposición/servicio/seguridad/operaciones/aceptación. Avance por gates con capacidades no verificadas deshabilitadas; un fake no pasa gate real. Checkpoints cada 5 y al final de 2.

| Fase | Documento | Estado | Checkpoint |
|---|---|---|---|
| 01 | [Baseline, fuentes y alcance](01-baseline-fuentes-y-alcance.md) | NOT_STARTED | — |
| 02 | [Autoridad por dominio y contrato SaaS](02-autoridad-por-dominio-y-contrato-saas.md) | NOT_STARTED | — |
| 03 | [Supabase JWT y principal](03-supabase-jwt-y-principal.md) | NOT_STARTED | — |
| 04 | [Twins y nomenclatura canónica](04-twins-y-nomenclatura-canonica.md) | NOT_STARTED | — |
| 05 | [DTOs, esquemas y errores](05-dtos-esquemas-y-errores.md) | NOT_STARTED | Informe |
| 06 | [Persistencia, RLS y migraciones](06-persistencia-rls-y-migraciones.md) | NOT_STARTED | — |
| 07 | [Mandatos, finalidad y aprobaciones](07-mandatos-finalidad-y-aprobaciones.md) | NOT_STARTED | — |
| 08 | [Secretos, discovery y aislamiento remoto](08-secretos-discovery-y-aislamiento-remoto.md) | NOT_STARTED | — |
| 09 | [Brief y estrategia](09-brief-y-estrategia.md) | NOT_STARTED | — |
| 10 | [Investigación de marca](10-investigacion-de-marca.md) | NOT_STARTED | Informe |
| 11 | [Naming y opciones](11-naming-y-opciones.md) | NOT_STARTED | — |
| 12 | [Clearance preliminar](12-clearance-preliminar.md) | NOT_STARTED | — |
| 13 | [Identidad verbal](13-identidad-verbal.md) | NOT_STARTED | — |
| 14 | [Direcciones visuales](14-direcciones-visuales.md) | NOT_STARTED | — |
| 15 | [Ledger de activos y derechos](15-ledger-de-activos-y-derechos.md) | NOT_STARTED | Informe |
| 16 | [Tipografía y fuentes](16-tipografia-y-fuentes.md) | NOT_STARTED | — |
| 17 | [Documento vectorial](17-documento-vectorial.md) | NOT_STARTED | — |
| 18 | [Adaptador Penpot](18-adaptador-penpot.md) | NOT_STARTED | — |
| 19 | [Canvas Fabric/SVG](19-canvas-fabric-svg.md) | NOT_STARTED | — |
| 20 | [Logotipo y variantes](20-logotipo-y-variantes.md) | NOT_STARTED | Informe |
| 21 | [Paleta y accesibilidad](21-paleta-y-accesibilidad.md) | NOT_STARTED | — |
| 22 | [Design tokens](22-design-tokens.md) | NOT_STARTED | — |
| 23 | [Style Dictionary](23-style-dictionary.md) | NOT_STARTED | — |
| 24 | [Plantillas y componentes](24-plantillas-y-componentes.md) | NOT_STARTED | — |
| 25 | [Layouts responsive](25-layouts-responsive.md) | NOT_STARTED | Informe |
| 26 | [Composición y edición](26-composicion-y-edicion.md) | NOT_STARTED | — |
| 27 | [QA de texto](27-qa-de-texto.md) | NOT_STARTED | — |
| 28 | [QA visual y revisión](28-qa-visual-y-revision.md) | NOT_STARTED | — |
| 29 | [Brandbook y reglas](29-brandbook-y-reglas.md) | NOT_STARTED | — |
| 30 | [Export y preflight](30-export-y-preflight.md) | NOT_STARTED | Informe |
| 31 | [Entrega y publicación](31-entrega-y-publicacion.md) | NOT_STARTED | — |
| 32 | [Aprendizaje y librería](32-aprendizaje-y-libreria.md) | NOT_STARTED | — |
| 33 | [Reportes, dashboard e infografías](33-reportes-dashboard-e-infografias.md) | NOT_STARTED | — |
| 34 | [Portal responsive, chat y Anam](34-portal-responsive-chat-y-anam.md) | NOT_STARTED | — |
| 35 | [SDK TypeScript, Hono y tools](35-sdk-typescript-hono-y-tools.md) | NOT_STARTED | Informe |
| 36 | [Bridge de agente y eventos](36-bridge-de-agente-y-eventos.md) | NOT_STARTED | — |
| 37 | [Cooperación y handoff empresarial](37-cooperacion-y-handoff-empresarial.md) | NOT_STARTED | — |
| 38 | [Modelos, coste y observabilidad](38-modelos-coste-y-observabilidad.md) | NOT_STARTED | — |
| 39 | [Privacidad y pruebas adversariales](39-privacidad-y-pruebas-adversariales.md) | NOT_STARTED | — |
| 40 | [Vertical E2E y fallos distribuidos](40-vertical-e2e-y-fallos-distribuidos.md) | NOT_STARTED | Informe |
| 41 | [Operaciones, CI, backup y release](41-operaciones-ci-backup-y-release.md) | NOT_STARTED | — |
| 42 | [Aceptación, evidencia y handoff final](42-aceptacion-evidencia-y-handoff-final.md) | NOT_STARTED | Informe |

Informe: SHA/PR/diff, versiones/entorno, fases PASS/BLOCKED/NOT_VERIFIED, tests realmente ejecutados/pasados/fallidos/skipped, fixtures/receipts/fuentes, costo/riesgos y siguiente dependencia. No contar escenarios planeados como tests. STOP ante fuga, bypass de autorización/revisión, secreto, doble efecto o pérdida de audit. Producción/pagos/firmas/actos regulados fuera de esta entrega.
