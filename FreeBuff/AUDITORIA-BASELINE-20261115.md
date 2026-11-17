# Auditoría de baseline real — agntia-branding

**2026-11-15 · AUDITORÍA, NO IMPLEMENTACIÓN.** Este documento sustituye cualquier suposición sobre el estado del repositorio por mediciones reproducibles. No se ha escrito código de aplicación, no se han ejecutado tests de producto y no se ha contactado ningún proveedor.

## Veredicto

| Pregunta | Respuesta medida |
|---|---|
| ¿Hay código de aplicación? | **No.** 174 archivos versionados: 169 `.md` + 5 `.json`. Cero `.ts/.tsx/.js/.sql/package.json`. |
| ¿El programa de 42 campañas está intacto? | **Sí.** 42 campañas, 294 tareas, 84 gates, conteos y patrones de ID verificados. |
| ¿Hay trabajo previo que conservar? | **Sí, documental**: 3 capas (original, factory/prep, execution-program) + FreeBuff. Se conserva íntegro; este commit solo añade. |
| ¿Alguna campaña está implementada? | **No.** 42/42 `NOT_STARTED`, 294/294 `NOT_STARTED`, 84/84 `NOT_EXECUTED`. |
| ¿Se puede ejecutar baseline de build/tests? | **No aplica**: no existe `package.json`, workspace, lockfile ni CI. |
| ¿Procede implementar en este encargo? | **No.** Ver §9: conflicto de autoridad + alcance autorizado documental. |

**Clasificación global: `DOC_ONLY` en 42/42 campañas. `PARTIAL` = 0. `CODE_PRESENT` = 0. Verificado en runtime = 0.**

## 1. SHA congelado y comandos de verificación

```
HEAD   = 7734d6d24b594201e8d7ab3b2e481fb3b40ef78e
fecha  = 2026-11-14 23:30:05 +0000
asunto = docs(FreeBuff): reconciliar fabrica integral 42 campañas con documentación original
rama   = freebuff/7133a8ec3028b03a36f68536 (base = main, fast-forward)
árbol  = limpio (git status --porcelain vacío)
```

```bash
git rev-parse HEAD                      # 7734d6d24b594201e8d7ab3b2e481fb3b40ef78e
git ls-files | wc -l                    # 174
git ls-files | sed 's/.*\.//' | sort | uniq -c   # 169 md, 5 json
jq -r '[(.campaigns|length),([.campaigns[].tasks[]]|length),([.campaigns[].gate_scenarios[]]|length)]|@tsv' \
  docs/campaigns/campaign.json          # 42   294   84
sha256sum docs/campaigns/campaign.json  # ee21fea48b7e8b98ab4d846730a99d78604a25d6dcbba35f6a71e3836ae85305
```

El `sha256` del manifest coincide **exactamente** con el registrado en `docs/release/document-validation.json`: el programa no ha sido alterado desde su validación. La divergencia está en la capa documental añadida después (ver D2).

## 2. Inventario de superficies y dependencias

| Capa | Rutas | Archivos | Función | Estado |
|---|---|---|---|---|
| Producto y dominio | `docs/01-producto.md`–`09-evaluacion.md` | 9 | Capacidad, investigación, referentes, adaptadores, seguridad, UX/Anam, servicio, costes, evaluación | Documental |
| Arquitectura | `docs/architecture/01..04` | 4 | Autoridad, Supabase/twins, compatibilidad con padre, runtime determinista | Documental |
| Contratos | `docs/contracts/01-contratos.md` | 1 | Envelope, DTOs, entidades, API nominada, tools, eventos | Propuesta |
| Campañas originales | `docs/campaigns/01..42` + `campaign.json` + `README` | 44 | Programa fuente de verdad de 42/294/84 | `NOT_STARTED` |
| fábrica/PREP | `docs/factory/00..06` + 3 handoffs, `docs/prep/README.md` | 12 | Marco de ejecución, léxico, ADTC, fronteras | Adenda |
| Programa de ejecución | `docs/execution-program/` (8 docs + 42 `CAMPAIGN.md`) | 50 | Granularización por campaña con patchsets y reporte | `DESIGN_ONLY` |
| Scaffolds | `docs/implementation/NN-slug/README.md` | 43 | Un scaffold conceptual por campaña + índice | Conceptual |
| Investigación | `docs/research/*.json` | 3 | Fuentes, repos por SHA, mapa del padre | Registro |
| Release/operación | `docs/release/` (4), `docs/operations/RUNBOOK.md` | 5 | Handoff, informe, aceptación, validación, runbook | Diseño |
| FreeBuff | `FreeBuff/*` | 1 → 5 | Handoff reconciliado + entregables de este encargo | Plan |

No hay duplicación destructiva: las tres capas describen el mismo programa con distinto nivel de detalle. La capa de ejecución **no** sustituye a la original; la referencia.

## 3. Matriz de campañas (42 × estado real)

Columnas: `Doc` = documento original; `Camp` = `CAMPAIGN.md` de ejecución; `Scaf` = scaffold `docs/implementation/NN-slug/`; `Evid` = artefactos `docs/implementation/cNN/{README,EVIDENCE,TESTS,RISKS}.md`; `Código` = archivos de producto existentes.

| ID | Campaña | Doc | Camp | Scaf | Evid | Código | Clasificación |
|---|---|---|---|---|---|---|---|
| BRD-C01 | Baseline, fuentes y alcance | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C02 | Autoridad por dominio y contrato SaaS | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C03 | Supabase JWT y principal | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C04 | Twins y nomenclatura canónica | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C05 | DTOs, esquemas y errores | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C06 | Persistencia, RLS y migraciones | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C07 | Mandatos, finalidad y aprobaciones | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C08 | Secretos, discovery y aislamiento remoto | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C09 | Brief y estrategia | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C10 | Investigación de marca | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C11 | Naming y opciones | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C12 | Clearance preliminar | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C13 | Identidad verbal | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C14 | Direcciones visuales | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C15 | Ledger de activos y derechos | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C16 | Tipografía y fuentes | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C17 | Documento vectorial | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C18 | Adaptador Penpot | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C19 | Canvas Fabric/SVG | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C20 | Logotipo y variantes | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C21 | Paleta y accesibilidad | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C22 | Design tokens | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C23 | Style Dictionary | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C24 | Plantillas y componentes | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C25 | Layouts responsive | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C26 | Composición y edición | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C27 | QA de texto | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C28 | QA visual y revisión | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C29 | Brandbook y reglas | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C30 | Export y preflight | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C31 | Entrega y publicación | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C32 | Aprendizaje y librería | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C33 | Reportes, dashboard e infografías | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C34 | Portal responsive, chat y Anam | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C35 | SDK TypeScript, Hono y tools | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C36 | Bridge de agente y eventos | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C37 | Cooperación y handoff empresarial | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C38 | Modelos, coste y observabilidad | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C39 | Privacidad y pruebas adversariales | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C40 | Vertical E2E y fallos distribuidos | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C41 | Operaciones, CI, backup y release | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |
| BRD-C42 | Aceptación, evidencia y handoff final | ✔ | ✔ | ✔ | 0/4 | 0 | `DOC_ONLY` |

Totales verificados: 42 documentos originales ✔, 42 `CAMPAIGN.md` ✔ (todos con sección `Reporte Freebuff` en `PENDING`), 42 scaffolds ✔, 168 artefactos de evidencia esperados / **0 presentes**, 0 archivos de producto.

Checkpoints declarados (9): C05, C10, C15, C20, C25, C30, C35, C40, C42. Los informes de checkpoint de las fases 5/10/15/20/25/30/35/40/42 **no existen** porque ninguna fase se ejecutó. No se emiten informes ficticios.

## 4. Matriz de diferencias (especificado vs existente)

| ID | Discrepancia | Evidencia | Impacto | Acción propuesta |
|---|---|---|---|---|
| **D1** | `planned_artifacts` del manifest apunta a `docs/implementation/cNN/{README,EVIDENCE,TESTS,RISKS}.md`, pero los scaffolds reales viven en `docs/implementation/NN-slug/README.md`. | 168 rutas esperadas, 168 ausentes (`[ -f ]` falla en todas). 42 scaffolds presentes en la ruta alternativa. | El reporte exigido por cada `CAMPAIGN.md` no tiene destino existente. Riesgo de que un agente cree 168 archivos nuevos duplicando los 42 scaffolds. | Decidir en el arranque de implementación: crear `cNN/` como carpeta de evidencia (sin mover scaffolds) **o** reescribir `planned_artifacts` en un commit con snapshot. No hacerlo unilateralmente ahora. |
| **D2** | `docs/release/document-validation.json` está obsoleto: declara `files_verified: 69` y `markdown_words: 57644`; el repo tiene **169** md y **139283** palabras. | `git ls-files '*.md' | xargs wc -w` | Un auditor puede concluir que faltan documentos o desconfiar del PASS. | Reemitir la validación en commit separado, conservando el registro histórico como evidencia de fecha. |
| **D3** | Rutas de código de los `CAMPAIGN.md` son parcialmente genéricas: `packages/contracts/src/NN.ts`, `apps/api/src/routes/NN.ts`, `tests/campaigns/NNN.test.ts`. | 207 rutas únicas propuestas bajo `apps/|packages/|tests/`, todas inexistentes. Solo la superficie de dominio es específica (p. ej. `packages/domain/src/visual-directions.ts`, `packages/tokens/src/index.ts`). | Los patchsets no son aplicables tal cual: un `NN.ts` no es un diseño de módulo. | Reconciliar rutas por campaña en el arranque, antes del primer patchset. |
| **D4** | Conflicto de autoridad: `docs/factory/HANDOFF-FREEBUFF.md` dice «No iniciar código todavía» (PREP/meta-auditoría Astra); `docs/execution-program/HANDOFF-GLOBAL-FREEBUFF.md` dice implementar las 42 sin esperar auditorías intermedias. | Dos handoffs contradictorios; el reconciliado ya exige preservar ambos. | **Gate de gobernanza**: sin resolución, el primer commit de código viola una de las dos instrucciones. | **Decisión del fundador** (ver §9). |
| **D5** | No hay `LICENSE`, `.gitignore`, `CONTRIBUTING` ni `.github/` (CI, CODEOWNERS, plantillas). | `git ls-files` solo md/json; sin directorio `.github`. | Bloquea C41 (CI/release) y complica incorporar OSS (Penpot MPL-2.0, Fabric/SVG-Edit MIT, Style Dictionary Apache-2.0). | Añadir en la fase de arranque autorizada; requiere decisión de licencia del repo (no asumir MIT). |
| **D6** | El SHA del padre `54b8d540…` es una referencia histórica, no verificada contra HEAD actual. | Declarado en `docs/architecture/03-compatibilidad-agente.md`, `campaign.json.parent_reference_sha`, `document-validation.json`. | Los mapeos de contratos pueden estar desactualizados; `parent_modifications_authorized: false`. | Re-cotejar en el arranque de C01 y registrar `hostSHA` real. **No** tocar el padre. |
| **D7** | No existe catálogo de variables de entorno ni mapa de secretos en todo el corpus. | `grep -riE 'DOPPLER|[A-Z][A-Z0-9_]{4,}_(KEY|TOKEN|SECRET|URL|ID)'` devuelve 1 mención de DOPPLER y 0 catálogos. | C08/Doppler no tenía entregable previo; el arranque habría improvisado nombres. | Resuelto documentalmente en `FreeBuff/DOPPLER-READY.md`. |
| **D8** | Licencia de `google/fonts` registrada como `UNKNOWN` y uso descrito solo por metadatos. | `docs/04-adaptadores.md`, `docs/research/repositories.json`. | C16 no puede aprobar tipografías por familia sin licencia leída; un fallback silencioso es fallo de gate. | Mantener `UNKNOWN` → fuente deshabilitada hasta lectura de licencia por familia. |

Ninguna discrepancia se ha "arreglado" reescribiendo documentos ajenos: D1/D2/D3/D5 requieren un commit autorizado propio y D4 requiere decisión humana.

## 5. Estado de gates (84)

| Estado | Escenarios |
|---|---|
| `NOT_EXECUTED` | 84/84 |
| `PASS` | 0 |
| `FAIL` | 0 |
| `BLOCKED` | 0 |

Los 84 escenarios son verificables por construcción (`BRD-CNN-G01` invariante de fase, `BRD-CNN-G02` fail-closed cross-tenant/mandato/versión). **Ninguno es ejecutable hoy**: no hay runtime, ni API, ni base de datos, ni tenant sintético. Declararlos de otro modo sería fabricar evidencia.

## 6. Baseline ejecutable: lo que se pudo y no se pudo correr

| Comprobación | Resultado | Motivo |
|---|---|---|
| `npm/pnpm install` | `NOT_APPLICABLE` | No hay `package.json`, workspace ni lockfile. |
| `typecheck` / `lint` | `NOT_APPLICABLE` | Sin código ni configuración de TS/ESLint. |
| `test` (unit/integration/e2e) | `NOT_APPLICABLE` | Sin runner ni suites; `implementation_tests_executed: 0` es correcto. |
| `build` | `NOT_APPLICABLE` | Sin build definido. |
| Workflows CI | `ABSENT` | No existe `.github/workflows`. |
| Migraciones / RLS | `ABSENT` | Sin SQL ni proyecto Supabase. |
| Proveedores / adaptadores | `NOT_IMPLEMENTED` | Ver §7. |
| Validación documental (JSON, links, IDs, DAG) | `PASS` histórico | `document-validation.json`; manifest hash aún coincide, métricas de corpus obsoletas (D2). |
| Auditoría de estructura de este documento | `PASS` | Conteos, patrones de ID, existencia de 42+42+42 rutas y 168 ausencias verificadas con `jq`/`find`. |

Ninguna comprobación se ha marcado `PASS` por inferencia. Donde no había entorno, el valor es `NOT_VERIFIED`/`NOT_APPLICABLE` explícito.

## 7. Integraciones reales vs simuladas

| Adaptador / capacidad | Estado real | Evidencia |
|---|---|---|
| Penpot (MPL-2.0) | `NOT_IMPLEMENTED` / licencia por metadatos | `docs/04-adaptadores.md` |
| Fabric / SVG-Edit (MIT) | `NOT_IMPLEMENTED` | ídem |
| Style Dictionary (Apache-2.0) | `NOT_IMPLEMENTED`; su licencia no cubre tokens/assets | ídem |
| Google Fonts | `NOT_IMPLEMENTED`; licencia `UNKNOWN` por familia | ídem |
| Supabase (JWT/RLS/Storage/Realtime) | `NOT_CONFIGURED` | `docs/architecture/02-identidad-twins.md` |
| Gateway de modelos | `NOT_CONFIGURED`; sin modelo, endpoint ni tarifa aprobados | `docs/08-costes.md` |
| Anam (presencia) | `NOT_CONFIGURED`; nunca identidad/firma | `docs/06-ux-anam.md` |
| Bridge con `agente` | `HOST_BRIDGE_NOT_VERIFIED` | `docs/architecture/03-compatibilidad-agente.md` |
| SDK / API / portal | `DOC_ONLY` (contratos propuestos) | `docs/contracts/01-contratos.md` |

**Cero integraciones reales. Cero mocks presentados como proveedor.** El corpus ya lo declara así y esta auditoría lo confirma.

## 8. Qué conserva y qué no toca este encargo

- **Conserva íntegro**: los 42 documentos originales, `campaign.json` (hash sin cambios), los 42 `CAMPAIGN.md`, los 42 scaffolds, factory/prep, arquitectura, contratos, release y runbook.
- **Añade solo**: 4 documentos en `FreeBuff/` y un puntero en el handoff reconciliado.
- **No toca**: `agente` ni repos hermanos, `main` de otros repositorios, proveedores, cuentas, datos reales, despliegues, pagos, publicaciones ni firmas.
- **No reescribe** ninguna campaña para "aprobar" un gate.

## 9. Condiciones de parada aplicadas

Se detiene la ejecución de código, no por falta de método sino por reglas vigentes:

1. **Alcance autorizado del proyecto** (`AGENTS.md`): el encargo es investigación, informes, contratos, planning y campañas; **no** código de aplicación, tests ejecutables, SDK, contenedores o despliegues. Una implementación futura «requiere autorización propia».
2. **D4 — conflicto de autoridad no resuelto**: PREP («no iniciar código») vs programa de ejecución («implementar sin esperar»). El propio handoff reconciliado exige decisión del fundador o registro como gate antes de código irreversible.
3. **D1/D3 — rutas de evidencia y patchsets no reconciliados**: escribir código sobre rutas genéricas `NN.ts` produciría artefactos que el programa no puede auditar después.
4. **D5 — sin licencia de repositorio ni CI**: incorporar OSS (Penpot/Fabric/Style Dictionary) sin `LICENSE` definido es un riesgo de cadena de suministro y de licencia.
5. **D6 — SHA del padre no revalidado**: C01 exige congelar `hostSHA` real antes de integrar contratos heredados.

Ninguna de estas cinco es un bloqueo técnico inventado: todas son verificables con los comandos de §1 y los documentos citados.

## 10. Evidence reproducible para auditoría independiente (Codex Cloud)

```bash
git clone https://github.com/uniscrolliabrain-cloud/agntia-branding && cd agntia-branding
git rev-parse HEAD                                   # esperado: SHA de este commit
git ls-files | wc -l                                 # 174 + archivos FreeBuff añadidos
git ls-files | sed 's/.*\.//' | sort | uniq -c        # solo md/json
jq -r '[.campaigns|length,([.campaigns[].tasks[]]|length),([.campaigns[].gate_scenarios[]]|length)]|@tsv' docs/campaigns/campaign.json
jq -r '[.campaigns[].status]|unique' docs/campaigns/campaign.json         # ["NOT_STARTED"]
jq -r '[.campaigns[].gate_scenarios[].status]|unique' docs/campaigns/campaign.json  # ["NOT_EXECUTED"]
jq -r '.campaigns[].planned_artifacts[]' docs/campaigns/campaign.json | sort -u | while read -r p; do
  [ -f "$p" ] || echo "AUSENTE $p"; done | wc -l       # 168
ls -d docs/implementation/*/ | wc -l                   # 42
grep -l 'Reporte Freebuff' docs/execution-program/campaigns/*/CAMPAIGN.md | wc -l  # 42
sha256sum docs/campaigns/campaign.json                 # ee21fea4… (sin cambios)
```

Criterio de aceptación de esta auditoría: los cuatro conteos (42/294/84, 168 ausencias, 42 scaffolds, 42 reportes `PENDING`) deben reproducirse. Cualquier diferencia implica que el programa cambió y esta matriz debe reemitirse.
