# FreeBuff — handoff reconciliado de fábrica completa (agntia-branding)

**14/11/2026 · PLAN, NO EJECUTADO.** Integradas en main las dos ramas documentales mediante PR #1 y PR #2. El programa fuente son `docs/campaigns/campaign.json`, sus 42 campañas originales y los 42 `docs/execution-program/campaigns/NNN/CAMPAIGN.md`. 42 campañas, 294 tareas, 84 gates; estado del manifest NOT_STARTED. **No sustituir la fábrica por un MVP, vertical ni scaffolding parcial.**

## Arquitectura y restricciones propias del dominio

# Arquitectura objetivo — Branding

Monorepo TS/pnpm/Hono, contratos Zod, Postgres RLS, JWT Supabase/membresías verificadas, core de brief, naming, identidad verbal/visual, assets/rights ledger, vector editable, Penpot opcional, Fabric/SVG, design tokens, Style Dictionary, plantillas, brandbook, preflight y export; SDK y portal con Anam. No instalar todos los adaptadores por defecto. Agentes canónicos en padre, twins aquí vinculados. Naming y logo clearance preliminar no equivale a registro de marca ni dictamen jurídico.

`JWT+membership → Hono → policy/AuthorityMap → BrandWorkOrder/version/approval → RLS+audit/outbox → scoped adapter/export → receipt/evidence → parent bridge`.


## Orden de lectura y resolución de contradicciones

Leer primero `docs/prep/` si existe, `docs/factory/` íntegro, `docs/architecture/`, `docs/contracts/`, `docs/campaigns/campaign.json`, documentos originales de las 42 campañas, `docs/implementation/`, `docs/execution-program/00-ESTADO-REAL-DEL-REPO.md`, `01-ARQUITECTURA-OBJETIVO.md`, `02-MAPA-DE-DEPENDENCIAS.md`, `03-PLAN-MAESTRO.md`, `04-CONTRATOS-E-INTEGRACIONES.md`, `HANDOFF-GLOBAL-FREEBUFF.md`, `CRITERIOS-DE-REPO-TERMINADO.md` y cada CAMPAIGN.md completa. Si la factory PREP pide Astra antes de implementar pero el programa posterior autoriza ejecución continua, **preservar ambos**, verificar aprobación del founder o registrar el conflicto como gate antes de código irreversible. El programa posterior puede granularizar pero no borrar invariantes originales.

## Matriz de campañas originales

- **BRD-C01** — Baseline, fuentes y alcance. Depende ninguna. Fuente `docs/campaigns/01-baseline-fuentes-y-alcance.md`, ejecución `docs/execution-program/campaigns/001/CAMPAIGN.md`. Invariante: No modificar agente ni convertir documentos en pruebas pasadas.
- **BRD-C02** — Autoridad por dominio y contrato SaaS. Depende BRD-C01. Fuente `docs/campaigns/02-autoridad-por-dominio-y-contrato-saas.md`, ejecución `docs/execution-program/campaigns/002/CAMPAIGN.md`. Invariante: Solapamiento permitido, responsable único por efecto.
- **BRD-C03** — Supabase JWT y principal. Depende BRD-C02. Fuente `docs/campaigns/03-supabase-jwt-y-principal.md`, ejecución `docs/execution-program/campaigns/003/CAMPAIGN.md`. Invariante: JWT válido sin membresía/scope no autoriza; no user_metadata/default.
- **BRD-C04** — Twins y nomenclatura canónica. Depende BRD-C03. Fuente `docs/campaigns/04-twins-y-nomenclatura-canonica.md`, ejecución `docs/execution-program/campaigns/004/CAMPAIGN.md`. Invariante: Agente canónico en padre; twin sin permiso propio.
- **BRD-C05** — DTOs, esquemas y errores. Depende BRD-C04. Fuente `docs/campaigns/05-dtos-esquemas-y-errores.md`, ejecución `docs/execution-program/campaigns/005/CAMPAIGN.md`. Invariante: Campos de identidad del LLM no prueban autorización.
- **BRD-C06** — Persistencia, RLS y migraciones. Depende BRD-C05. Fuente `docs/campaigns/06-persistencia-rls-y-migraciones.md`, ejecución `docs/execution-program/campaigns/006/CAMPAIGN.md`. Invariante: FK/consultas/roles reales impiden contaminación.
- **BRD-C07** — Mandatos, finalidad y aprobaciones. Depende BRD-C06. Fuente `docs/campaigns/07-mandatos-finalidad-y-aprobaciones.md`, ejecución `docs/execution-program/campaigns/007/CAMPAIGN.md`. Invariante: Proponente no se aprueba ni amplía payload/ámbito.
- **BRD-C08** — Secretos, discovery y aislamiento remoto. Depende BRD-C07. Fuente `docs/campaigns/08-secretos-discovery-y-aislamiento-remoto.md`, ejecución `docs/execution-program/campaigns/008/CAMPAIGN.md`. Invariante: Sin URL/model/method libre ni fallback admin.
- **BRD-C09** — Brief y estrategia. Depende BRD-C08. Fuente `docs/campaigns/09-brief-y-estrategia.md`, ejecución `docs/execution-program/campaigns/009/CAMPAIGN.md`. Invariante: No inferir preferencias sensibles o estrategia como hecho del cliente.
- **BRD-C10** — Investigación de marca. Depende BRD-C09. Fuente `docs/campaigns/10-investigacion-de-marca.md`, ejecución `docs/execution-program/campaigns/010/CAMPAIGN.md`. Invariante: Fuentes no confiables no dictan tools o copias.
- **BRD-C11** — Naming y opciones. Depende BRD-C10. Fuente `docs/campaigns/11-naming-y-opciones.md`, ejecución `docs/execution-program/campaigns/011/CAMPAIGN.md`. Invariante: Nombre sugerido no está jurídicamente disponible por defecto.
- **BRD-C12** — Clearance preliminar. Depende BRD-C11. Fuente `docs/campaigns/12-clearance-preliminar.md`, ejecución `docs/execution-program/campaigns/012/CAMPAIGN.md`. Invariante: No registrar ni prometer exclusividad sin revisión.
- **BRD-C13** — Identidad verbal. Depende BRD-C12. Fuente `docs/campaigns/13-identidad-verbal.md`, ejecución `docs/execution-program/campaigns/013/CAMPAIGN.md`. Invariante: Testimonios y promesas necesitan fuente y permiso.
- **BRD-C14** — Direcciones visuales. Depende BRD-C13. Fuente `docs/campaigns/14-direcciones-visuales.md`, ejecución `docs/execution-program/campaigns/014/CAMPAIGN.md`. Invariante: Moodboard no da licencia para copiar imágenes.
- **BRD-C15** — Ledger de activos y derechos. Depende BRD-C14. Fuente `docs/campaigns/15-ledger-de-activos-y-derechos.md`, ejecución `docs/execution-program/campaigns/015/CAMPAIGN.md`. Invariante: Todo uso final exige rights vigentes para propósito.
- **BRD-C16** — Tipografía y fuentes. Depende BRD-C15. Fuente `docs/campaigns/16-tipografia-y-fuentes.md`, ejecución `docs/execution-program/campaigns/016/CAMPAIGN.md`. Invariante: Sin fallback silencioso ni licencia genérica de todo Google Fonts.
- **BRD-C17** — Documento vectorial. Depende BRD-C16. Fuente `docs/campaigns/17-documento-vectorial.md`, ejecución `docs/execution-program/campaigns/017/CAMPAIGN.md`. Invariante: Editable y render tienen revisiones vinculadas.
- **BRD-C18** — Adaptador Penpot. Depende BRD-C17. Fuente `docs/campaigns/18-adaptador-penpot.md`, ejecución `docs/execution-program/campaigns/018/CAMPAIGN.md`. Invariante: Workspace externo no equivale tenant local; métodos verificados.
- **BRD-C19** — Canvas Fabric/SVG. Depende BRD-C18. Fuente `docs/campaigns/19-canvas-fabric-svg.md`, ejecución `docs/execution-program/campaigns/019/CAMPAIGN.md`. Invariante: SVG/XML no ejecutables ni URLs externas arbitrarias.
- **BRD-C20** — Logotipo y variantes. Depende BRD-C19. Fuente `docs/campaigns/20-logotipo-y-variantes.md`, ejecución `docs/execution-program/campaigns/020/CAMPAIGN.md`. Invariante: No semejanza declarada legalmente segura por modelo.
- **BRD-C21** — Paleta y accesibilidad. Depende BRD-C20. Fuente `docs/campaigns/21-paleta-y-accesibilidad.md`, ejecución `docs/execution-program/campaigns/021/CAMPAIGN.md`. Invariante: Contraste no se certifica con juicio visual del LLM.
- **BRD-C22** — Design tokens. Depende BRD-C21. Fuente `docs/campaigns/22-design-tokens.md`, ejecución `docs/execution-program/campaigns/022/CAMPAIGN.md`. Invariante: Alias cíclicos y tipos inválidos no exportan.
- **BRD-C23** — Style Dictionary. Depende BRD-C22. Fuente `docs/campaigns/23-style-dictionary.md`, ejecución `docs/execution-program/campaigns/023/CAMPAIGN.md`. Invariante: No transforms/script libre del agente.
- **BRD-C24** — Plantillas y componentes. Depende BRD-C23. Fuente `docs/campaigns/24-plantillas-y-componentes.md`, ejecución `docs/execution-program/campaigns/024/CAMPAIGN.md`. Invariante: Slot editable no permite romper derechos o mensajes obligatorios.
- **BRD-C25** — Layouts responsive. Depende BRD-C24. Fuente `docs/campaigns/25-layouts-responsive.md`, ejecución `docs/execution-program/campaigns/025/CAMPAIGN.md`. Invariante: Una captura desktop no prueba móvil/accesibilidad.
- **BRD-C26** — Composición y edición. Depende BRD-C25. Fuente `docs/campaigns/26-composicion-y-edicion.md`, ejecución `docs/execution-program/campaigns/026/CAMPAIGN.md`. Invariante: Tool no recibe shell/DOM libre o URL arbitraria.
- **BRD-C27** — QA de texto. Depende BRD-C26. Fuente `docs/campaigns/27-qa-de-texto.md`, ejecución `docs/execution-program/campaigns/027/CAMPAIGN.md`. Invariante: Texto renderizado debe coincidir con fuente aprobada.
- **BRD-C28** — QA visual y revisión. Depende BRD-C27. Fuente `docs/campaigns/28-qa-visual-y-revision.md`, ejecución `docs/execution-program/campaigns/028/CAMPAIGN.md`. Invariante: Juez de visión no sustituye aceptación humana o licencia.
- **BRD-C29** — Brandbook y reglas. Depende BRD-C28. Fuente `docs/campaigns/29-brandbook-y-reglas.md`, ejecución `docs/execution-program/campaigns/029/CAMPAIGN.md`. Invariante: Manual usa solo reglas/activos aprobados.
- **BRD-C30** — Export y preflight. Depende BRD-C29. Fuente `docs/campaigns/30-export-y-preflight.md`, ejecución `docs/execution-program/campaigns/030/CAMPAIGN.md`. Invariante: PDF/PNG/SVG no prueban fidelidad sin preflight.
- **BRD-C31** — Entrega y publicación. Depende BRD-C30. Fuente `docs/campaigns/31-entrega-y-publicacion.md`, ejecución `docs/execution-program/campaigns/031/CAMPAIGN.md`. Invariante: Exportar no autoriza publicar o hacer deploy.
- **BRD-C32** — Aprendizaje y librería. Depende BRD-C31. Fuente `docs/campaigns/32-aprendizaje-y-libreria.md`, ejecución `docs/execution-program/campaigns/032/CAMPAIGN.md`. Invariante: No memoria compartida de estilos privados de clientes.
- **BRD-C33** — Reportes, dashboard e infografías. Depende BRD-C32. Fuente `docs/campaigns/33-reportes-dashboard-e-infografias.md`, ejecución `docs/execution-program/campaigns/033/CAMPAIGN.md`. Invariante: No inventar cifras/fechas/estado completado.
- **BRD-C34** — Portal responsive, chat y Anam. Depende BRD-C33. Fuente `docs/campaigns/34-portal-responsive-chat-y-anam.md`, ejecución `docs/execution-program/campaigns/034/CAMPAIGN.md`. Invariante: Token Anam no es JWT ni firma; chat lateral y móvil accesibles.
- **BRD-C35** — SDK TypeScript, Hono y tools. Depende BRD-C34. Fuente `docs/campaigns/35-sdk-typescript-hono-y-tools.md`, ejecución `docs/execution-program/campaigns/035/CAMPAIGN.md`. Invariante: Mismo PEP en API/SDK/MCP/Anam, sin passthrough.
- **BRD-C36** — Bridge de agente y eventos. Depende BRD-C35. Fuente `docs/campaigns/36-bridge-de-agente-y-eventos.md`, ejecución `docs/execution-program/campaigns/036/CAMPAIGN.md`. Invariante: Solo patch propuesto/documentado; cero escrituras al padre.
- **BRD-C37** — Cooperación y handoff empresarial. Depende BRD-C36. Fuente `docs/campaigns/37-cooperacion-y-handoff-empresarial.md`, ejecución `docs/execution-program/campaigns/037/CAMPAIGN.md`. Invariante: Emitir evento no prueba recepción; rota empresarial vive en padre.
- **BRD-C38** — Modelos, coste y observabilidad. Depende BRD-C37. Fuente `docs/campaigns/38-modelos-coste-y-observabilidad.md`, ejecución `docs/execution-program/campaigns/038/CAMPAIGN.md`. Invariante: Bolsas30/70/300 hipótesis, no gasto o plan contratado.
- **BRD-C39** — Privacidad y pruebas adversariales. Depende BRD-C38. Fuente `docs/campaigns/39-privacidad-y-pruebas-adversariales.md`, ejecución `docs/execution-program/campaigns/039/CAMPAIGN.md`. Invariante: Fuga/bypass/secreto/doble efecto detienen rollout.
- **BRD-C40** — Vertical E2E y fallos distribuidos. Depende BRD-C39. Fuente `docs/campaigns/40-vertical-e2e-y-fallos-distribuidos.md`, ejecución `docs/execution-program/campaigns/040/CAMPAIGN.md`. Invariante: Mock no acredita proveedor real; respuesta correcta no compensa acción prohibida.
- **BRD-C41** — Operaciones, CI, backup y release. Depende BRD-C40. Fuente `docs/campaigns/41-operaciones-ci-backup-y-release.md`, ejecución `docs/execution-program/campaigns/041/CAMPAIGN.md`. Invariante: No producción, compras o wiring de padre por terminar fases.
- **BRD-C42** — Aceptación, evidencia y handoff final. Depende BRD-C41. Fuente `docs/campaigns/42-aceptacion-evidencia-y-handoff-final.md`, ejecución `docs/execution-program/campaigns/042/CAMPAIGN.md`. Invariante: No declarar paridad mundial, cumplimiento universal o tests inexistentes.

## Prompt maestro para Freebuff Cloud

> Ejecuta la fábrica completa de agntia-branding y sus 42 campañas, NO un MVP ni una vertical aislada. Congela SHA de main y ramas, inventaría código real y distingue CODE_PRESENT/PARTIAL/ABSENT de DOC_ONLY. Lee originales, manifest, arquitectura, contratos y el texto completo de cada CAMPAIGN.md antes de escribir. Para cada campaña: verificar dependencias, identificar paths reales/propuestos, escribir patchsets específicos por DTO/Zod, Hono, dominio determinista, RLS/migraciones, outbox/worker, adapters, SDK, portal, tests y rollback; implementar las 7 tareas y comprobar los 2 gates con fixtures adversariales y dos tenants. No crear endpoints ficticios para tareas documentales ni instalar todos los proveedores opcionales. Rama aislada y un writer por superficie. Tras cada campaña, rellenar exactamente el reporte que exige su CAMPAIGN.md con SHA, PR, diffs, comandos y exit codes, PASS/FAIL/SKIP/BLOCKED, gates, contradicciones, deuda y aprendizaje. Continuar con trabajo independiente si un proveedor está BLOCKED; nunca llamar PASS a un mock o a documentación. Al finalizar C42 generar `docs/execution-evidence/FINAL-FREEBUFF-REPORT.md` con matriz 42×7 y 84 gates, E2E sintético de dos tenants, licencias, privacidad, costes, rollback y pendientes. Codex audita el SHA final y el founder decide merges/release. No tocar `/agente`, gestoría, repos hermanos, main, proveedores reales, despliegues, pagos, publicaciones ni envíos sin aprobación.

## Entregables de integración posteriores

`FreeBuff/DOPPLER-READY.md`: nombres de variables, entorno, owners, scopes, rotación, fail-closed, sin secretos ni instalación. `FreeBuff/INTEGRATION-AGENTE-PROPOSAL.md`: esquema de JWT/membresía, twins, AuthorityMap, SDK/bridge, idempotencia, ADTC/eventos, approvals, tests y rollback, **sin editar el padre**. `FreeBuff/FOUNDER-FINAL-REPORT.md`: evidencias y estado honesto. Este handoff no ejecuta tests ni concede autorización de producción.

## Entregables emitidos (2026-11-15, base `7734d6d`)

Los tres documentos anteriores existen ya, más la auditoría que los precede. Estado del programa sin cambios: 42 campañas `NOT_STARTED`, 294 tareas `NOT_STARTED`, 84 gates `NOT_EXECUTED`, 0 código, 0 tests de producto.

1. [`AUDITORIA-BASELINE-20261115.md`](AUDITORIA-BASELINE-20261115.md) — SHA congelado, matriz 42 campañas, 8 discrepancias (evidencia `cNN` ausente, rutas genéricas, validación obsoleta, conflicto PREP/ejecución, sin LICENSE/CI, SHA padre no revalidado, sin catálogo de secretos, licencia tipográfica `UNKNOWN`), condiciones de parada y comandos de reproducción.
2. [`DOPPLER-READY.md`](DOPPLER-READY.md) — catálogo de variables con ámbito/lector/rotación, entornos `dev`/`stg`/`prd`, matriz fail-closed. Sin valores ni instalación.
3. [`INTEGRATION-AGENTE-PROPOSAL.md`](INTEGRATION-AGENTE-PROPOSAL.md) — contratos heredados, TwinBinding, AuthorityMap, API/tools, eventos, idempotencia, approvals, pruebas y 6 propuestas al padre **no ejecutadas**.
4. [`FOUNDER-FINAL-REPORT.md`](FOUNDER-FINAL-REPORT.md) — informe honesto, matriz 42×7, riesgos y la decisión pendiente del fundador.

La implementación de las 42 campañas **no** se ha iniciado: el alcance autorizado de este encargo es documental y el conflicto de autoridad PREP vs programa de ejecución requiere decisión del fundador (§9 de la auditoría).
