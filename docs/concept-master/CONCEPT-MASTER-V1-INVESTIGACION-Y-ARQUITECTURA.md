# AGNTIA BRANDING — CONCEPT MASTER V1
## Brand Intelligence, Identity & Design Operating System
**15 de noviembre de 2026 · Investigación y arquitectura de destino · No implementado**

> **Tesis:** convertir el branding en un sistema empresarial vivo: investigar el mercado y el significado de la marca, diseñar una identidad original, convertirla en un sistema editable y ejecutable, custodiar derechos y coherencia, distribuirla a todos los canales y aprender de su uso real. **Una imagen visualmente atractiva no equivale a un diseño editable, un logotipo generado no equivale a una marca registrable y un archivo exportado no equivale a una entrega íntegra.**

## 0. Evidencia y estado del repositorio

**Inspección directa del repositorio:** README, AGENTS.md, índice, producto, investigación, benchmark, adaptadores, arquitectura y registros JSON de fuentes/repos. Estado `DOCUMENTATION_ONLY`: 42 campañas `NOT_STARTED`, tests `NOT_EXECUTED`, sin aplicación, SDK, integración, editor o render productivo. La investigación heredada examinó selectivamente tres referentes (Figma, Canva, Adobe AEM Assets), tres papers y cinco repositorios, con SHAs de lectura, no de despliegue. El Concept Master en `docs/concept-master/CONCEPT-MASTER.md` no existía al inspeccionarlo. **No atribuir capacidades funcionales a este repo.**

**Fuentes externas revisadas ahora:** abstracts de Graphic-Design-Bench y Designer-RSI; repositorio, integración API/MCP y documentación de design tokens de Penpot. Otras compañías y repos se incorporan como candidatos a investigar, no como auditorías terminadas. Los contratos, motores, cifras objetivo y arquitectura son **DISEÑO** hasta que exista código y tests.

**Restricciones:** no registrar marcas ni declarar disponibilidad legal, no copiar identidades, no utilizar activos sin derechos, no publicar/desplegar ni gastar sin permiso, no eliminar originales, no ejecutar código embebido de SVG ni permitir que un LLM firme una aprobación. Un archivo editado por un agente requiere autoridad del owner y versionado. Preservar el repo y sus 42 campañas.

## 1. Visión del producto: una empresa de identidad que aprende

La empresa cliente no quiere «un logo». Quiere una identidad coherente que sobreviva a canales, idiomas, equipos, cambios de mercado, fusiones, nuevos productos, vídeos, interfaces y materiales. La plataforma combina **consultoría estratégica**, **estudio de diseño**, **sistema de marca como código**, **gestión de activos y derechos**, **control de calidad**, **gobierno de versiones** y **distribución transversal**. La IA conversa y propone; los motores tipados compilan, validan, renderizan y exportan; el humano decide.

**Productos de salida:** research dossier con fuentes; estrategia de posicionamiento y arquitectura de marcas; naming shortlist con conflictos preliminares; tono de voz y narrativa; identidad visual; logotipo y variantes; paletas y tipografías licenciadas; design tokens semánticos; componentes; plantillas multicanal; brandbook vivo; paquete editable; exports SVG/PNG/PDF/JSON/CSS; manifests de licencias, hashes, versiones y decisiones. Entregas por idioma, formato y canal. La posibilidad de registrar una marca se decide por el proceso legal correspondiente, nunca por una búsqueda web automática.

### Once innovaciones arquitectónicas

1. **Brand Reality Graph:** relaciones entre empresa, mercado, audiencias, claims, competidores, elementos visuales, activos, usos y evidencia.
2. **Brand Genome Compiler:** reglas tipadas que transforman estrategia y restricciones en tokens, patrones, componentes y verificadores.
3. **Canonical Design Document (CDD):** árbol editable con constraints, nodos, texto, fonts, assets y revisiones; imagen raster como proyección.
4. **Design Intent Ledger:** explica decisiones, alternativas rechazadas, evidencias y criterios de aprobación.
5. **Brand Consistency Graph:** rastrea dependencias entre tokens, assets, páginas, campañas, vídeos y canales.
6. **Rights & Provenance Passport:** permisos de fuentes, fotografías, ilustraciones, música, voz, modelos y transformaciones.
7. **Reproducible Render Engine:** manifiesto de engine, fuentes, versión, color, dimensiones, hashes y tolerancias.
8. **Multi-Channel Identity Compiler:** exporta variantes semánticas sin destruir la identidad para web, social, impresión y vídeo.
9. **Brand Drift Observatory:** identifica usos incoherentes, versiones antiguas y accesibilidad degradada con fuentes.
10. **Procedural Design Memory:** aprende procedimientos de diseño solo tras replay de regresión y autorización; no memoriza datos privados.
11. **Brand Evolution Simulator:** evalúa propuestas de cambio y efectos sobre activos y canales; simulación no prueba respuesta del mercado.

## 2. Papers: lectura crítica y consecuencias verificables

### 2.1 Graphic-Design-Bench — arXiv:2604.04192

**Observado:** benchmark de 50 tareas en cinco ejes —layout, tipografía, infografías, semántica de plantillas y animación— con comprensión y generación, evaluando exactitud espacial, calidad perceptual, fidelidad de texto, alineación semántica y validez estructural. Señala limitaciones en razonamiento espacial complejo, vector, tipografía y descomposición temporal. Fuente: https://arxiv.org/abs/2604.04192

**Consecuencia:** un render agradable puede tener texto incorrecto, un SVG inválido, layers imposibles de editar o restricciones rotas. Nuestro `DesignQualityHarness` debe evaluar **cinco dimensiones independientes**: geometría, tipografía, estructura, significado y render. La evaluación de belleza humana es complementaria, no sustituto de tests estructurales. **No se han reproducido las puntuaciones ni incorporado el dataset.**

### 2.2 Designer-RSI — arXiv:2609.22086

**Observado:** propone memoria procedimental externa para agentes de diseño, con ampliación y revisión de habilidades mediante replay que evita regresiones. El paper reporta cinco rondas, 1.406 briefs y 1.869 trayectorias evaluadas; resultados son de los autores y sus modelos. Fuente: https://arxiv.org/abs/2609.22086

**Consecuencia:** `DesignSkill = {taskClass, preconditions, toolAllowlist, steps, expectedArtifacts, failureCases, replaySuite, version, provenance}`. Una nueva skill no entra en producción por un ejemplo exitoso: debe reparar fallos y no empeorar casos anteriores. No entrenar ni promover skills automáticamente con diseños confidenciales de clientes. La memoria procedimental es distinta de memoria privada de marca.

### 2.3 GraphicBench — arXiv:2504.11571

**Observado en investigación previa:** separación entre planificación creativa y ejecución de artefactos. **Consecuencia:** comparar plan propuesto, grafo de dependencias, operaciones de editor y documento final. Un plan excelente con un export ilegible es fallo. Fuente: https://arxiv.org/abs/2504.11571. Reproducción pendiente.

### 2.4 Líneas científicas complementarias a investigar

**Percepción y composición:** Gestalt, jerarquía visual, percepción preatentiva, semiótica y reconocimiento. **Tipografía:** shaping Unicode, OpenType, kerning, bidi, fallback, line-breaking y métricas de glifos. **Color:** sRGB/Display-P3/CMYK, ICC, contraste, diferencias perceptuales y variación de soporte. **Optimización:** constraint satisfaction, layout solvers, búsqueda multiobjetivo y render differentiable donde sea viable. **Sistemas de diseño:** design tokens, componentes, variantes, theming y accesibilidad. **Estrategia de marca:** investigación cualitativa, posicionamiento, arquitectura de portafolio, pruebas de recuerdo y comprensión, sesgos de investigación. No asumir que una teoría explica universalmente la preferencia de una audiencia.

## 3. Referentes mundiales: capacidades que estudiar, sin paridad fingida

| Referente | Superficie | Qué investigar de verdad | Hipótesis Agntia |
|---|---|---|---|
| Figma | editor colaborativo, design systems | API, plugins, variables, constraints, límites de automatización | documentos editables gobernados |
| Canva | plantillas, Brand Kit, colaboración | edición, licencias, export y APIs por plan | creatividad accesible para pymes |
| Adobe Illustrator | vector profesional | precisión SVG/PDF, tipografía, perfiles | pipeline vector reproducible |
| Adobe Photoshop | edición raster | PSD, layers, derechos, raster | editor externo opcional |
| Adobe Express | producción multicanal | plantillas y consistencia | compilador de formatos |
| Adobe AEM Assets | DAM y gobernanza | metadatos, permisos, variantes | asset passport y distribución |
| Penpot | open source, tokens, API/MCP | import/export, plugins, tokens, seguridad | candidato a editor principal |
| Sketch | editor UI y librerías | interoperabilidad y export | portabilidad de documentos |
| Affinity Designer | diseño vector/raster | formatos y licencia | ruta profesional externa |
| CorelDRAW | identidad/impresión | prepress, vector y PDF | entrega impresa fiable |
| Framer | web design | componentes y despliegue | handoff a Web |
| Webflow | CMS y diseño web | tokens, componentes, API | publicación con efecto owner |
| Frontify | brand management | gobernanza de activos | brand portal vivo |
| Bynder | DAM enterprise | rights, metadata y renditions | ledger de derechos |
| Brandfolder | DAM y distribución | search y approval | asset registry |
| Zeroheight | design-system docs | documentación viva | brandbook generado de fuente |
| Supernova | design-to-code | tokens y sync | compilación de diseño |
| Tokens Studio | token workflows | DTCG y versionado | token compiler |
| Looka | identidad generativa | onboarding y variantes | benchmark de experiencia |
| Tailor Brands | marca para pymes | flujo de creación y negocio | integración de identidad y empresa |

**Método obligatorio por compañía:** ficha con producto/edición, fecha, documentación oficial, screenshots/experiencia autorizada, capacidad comprobada, API, restricciones, precios verificables, licencias, export editable, soporte de fuentes, gobernanza, coste de operación, calidad y riesgos. Las 20 filas son **mapa competitivo**, no 20 auditorías ejecutadas. Priorizar pruebas reales de Penpot, Figma, Canva y Adobe, y comparación DAM con Frontify/Bynder.

## 4. Repositorios y tecnologías abiertas

| Repositorio/estándar | Qué ofrece o permite estudiar | Estado de licencia/evidencia | Decisión |
|---|---|---|---|
| `penpot/penpot` | editor open source, SVG/CSS, colaboración, API/MCP | MPL-2.0 según metadatos y repo | candidato prioritario, aislar instancia |
| `fabricjs/fabric.js` | canvas y objetos editables | MIT según metadata | editor ligero opcional |
| `SVG-Edit/svgedit` | edición SVG | MIT según metadata | laboratorio de interoperabilidad |
| `style-dictionary/style-dictionary` | build de tokens | Apache-2.0 según metadata | compilación de tokens |
| `google/fonts` | fuentes y metadatos | licencia por familia | catálogo, nunca licencia global |
| `konvajs/konva` | canvas interactivo | licencia a revisar por release | alternativa de editor |
| `svgdotjs/svg.js` | manipulación SVG | licencia a revisar | utilidades tipadas |
| `resvg/resvg` | render SVG | licencia a revisar | raster determinista |
| `linebender/vello` | render 2D GPU | licencia a revisar | exploración futura |
| `harfbuzz/harfbuzz` | text shaping | licencia a revisar | exactitud tipográfica |
| `fonttools/fonttools` | inspección y subsetting | licencia a revisar | fonts y export |
| `google/skia` | render 2D | licencia a revisar | benchmark engine |
| `w3c/design-tokens` | DTCG tokens | especificación | formato de intercambio |
| `w3c/svgwg` | SVG specs | especificación | compatibilidad y sanitización |
| `w3c/wcag` | accesibilidad | estándares | criterios de QA |
| `c2pa-org` | provenance | especificaciones/herramientas | investigar manifest, no veracidad |

**Pins internos anteriores (lectura, no instalación):** Penpot `d774e197d0435422bcfd3cac3064622ea79396d3`; Fabric `ab604137e04dd7d3d566462a6b27f5863e37c60b`; SVG-Edit `c44f061d2f9a626d2771cc931298af5a45522d87`; Style Dictionary `795233d9bee6a7b5787d685d75d626df3399d24d`; Google Fonts `3e5667764ccfea32ce0c3d58a3a4756de890adc1`. Antes de incorporar: checkout a release/SHA, LICENSE/NOTICE por componente, vulnerabilidades, APIs reales, tests de formatos, sandbox y coste.

**Hallazgo nuevo en Penpot:** documentación oficial de API, webhooks, plugins y MCP; design tokens nativos compatibles con el borrador W3C DTCG, import/export y uso en componentes. Fuente: https://penpot.app/integrations-api ; https://help.penpot.dev/user-guide/design-systems/design-tokens/ ; https://github.com/penpot/penpot/blob/develop/mcp/README.md. **Riesgo crítico:** el MCP oficial puede permitir ejecución de código en el entorno de plugin para operar sobre el documento. No exponer un `executeCode` general al agente; crear un adaptador de acciones nominadas, validación de AST/operaciones, límites de archivos, revisión y auditoría. Verificar qué operaciones están realmente soportadas por la versión instalada.

## 5. Arquitectura de destino: doce planos

1. **Identity & Mandate:** Supabase JWT verificado; memberships, roles, ACL de proyectos/archivos, mandatos de operador, twin y caducidad.
2. **Brand Research:** fuentes autorizadas, hipótesis de mercado, competidores, narrativa y evidencia.
3. **Strategy & Naming:** posicionamiento, arquitectura de marca, tono, naming y revisión legal preliminar.
4. **Brand Genome:** reglas tipadas, principios, tokens, restricciones y policy compiler.
5. **Canonical Design Document:** nodos editables, constraints, texto, componentes, assets y revisiones.
6. **Design Agent Runtime:** planificador, SOPs, tools nominadas, skill memory con replay y validadores.
7. **Rendering & QA:** render determinista, tipografía, contraste, accesibilidad, pixel diff y geometría.
8. **Rights & Provenance:** fuentes, licencias, permisos, consentimiento, transformaciones, expiraciones.
9. **Asset & Design System:** DAM, design tokens, componentes, plantillas, variantes y distribución.
10. **Collaboration & Approvals:** revisiones, comentarios, diff, firma de decisión y release.
11. **Export & Delivery:** SVG/PNG/PDF/JSON/CSS, manifest, recibos y handoff.
12. **Analytics & Governance:** drift, coherencia, impacto, presupuesto, audit, backups y restore.

### 5.1 Canonical Design Document (CDD)

```ts
type DesignNode = {
  id: string;
  type: "frame" | "group" | "vector" | "text" | "image" | "component";
  parentId?: string;
  children?: string[];
  geometry: { x: number; y: number; width: number; height: number; rotation?: number };
  constraints?: { horizontal: string; vertical: string; layout?: "flex" | "grid" | "absolute" };
  styleRefs: string[];
  text?: { content: string; fontAssetRef: string; locale: string; direction?: "ltr" | "rtl" };
  assetRef?: string;
  componentRef?: string;
};
type DesignDocument = {
  tenantId: string; projectId: string; documentId: string;
  revision: number; schemaVersion: string;
  rootNodeIds: string[]; nodes: Record<string, DesignNode>;
  tokenSetRef: string; assetManifestRef: string;
  policyVersion: string; sourceRefs: string[];
};
type ExportManifest = {
  documentRef: string; revision: number;
  engineName: string; engineVersion: string;
  fontHashes: string[]; assetHashes: string[];
  colorProfile: string; dimensions: string[];
  outputHashes: string[]; rightsSnapshotRef: string;
  approvalRef: string;
};
```

**Invariantes:** grafo de nodos acíclico; IDs estables; constraints compatibles; referencias a tokens existentes; texto exacto Unicode; fuentes identificadas por hash y licencia; ningún recurso externo descargado por el renderer sin allowlist; orden de capas explícito; SVG saneado sin scripts, foreignObject peligroso, entidades externas ni enlaces activos no autorizados. No confiar en un PNG como fuente de edición. El esquema es propuesta, no API existente.

### 5.2 Brand Genome y tokens

`BrandStrategy → BrandPolicy → TokenSets → SemanticTokens → Components → Templates → Variants → RenderedAssets`. Tokens primitivos (`color.blue.500`), semánticos (`color.brand.primary`), de componente (`button.primary.background`) y contextuales (`theme.dark.*`, `channel.print.*`). Resolver alias como DAG, detectar ciclos, conflictos y valores fuera de rango. Preservar DTCG `$type`, `$value`, `$description` y referencias; registrar transforms para CSS, Tailwind, Penpot y web. **No cambiar valores de marca aprobados porque un LLM prefiera otro tono.**

**BrandPolicyCompiler:** `PASS | FAIL | NEEDS_REVIEW | UNSUPPORTED` por regla con evidencia: logo clear space, contraste, tamaños mínimos, ratio, tipografía, paleta, claims, disclosures, fondos, idioma, versiones y restricciones de licencia. Reglas computables se verifican con algoritmos; criterios estéticos subjetivos requieren revisión humana.

### 5.3 Render reproducible y QA

**Pipeline:** parse/validate CDD → resolver tokens/assets → font shaping → layout constraints → vector scene → raster/PDF → QA → export manifest. **Pruebas:** exactitud de texto, clipping/overflow, contrast ratio cuando aplica, legibilidad mínima, alineación, tamaños, safe areas, color profile, raster quality, glyph fallback, embedding, edición posterior, determinismo por engine/versión. Pixel diff con tolerancia declarada; no exigir igualdad byte a byte cuando fuentes/OS difieren sin fijar entorno.

**Diff semántico:** cambios de texto, geometría, token, asset, fuente, derecho, idioma y orden de capas; mostrar impacto en canales y plantillas. Un cambio en font metrics puede romper 40 diseños; ejecutar tests de regresión antes de release.

### 5.4 Asset Rights Passport

`Asset = {tenantId, hash, origin, creatorClaim, rightsGrantRefs, license, permittedUses, expiry, transformations, modelRef?, consentRefs?, sourceEvidenceRefs, restrictions}`. Distinguir **procedencia** de **derecho**: tener el hash de una imagen no concede licencia. Fuente tipográfica requiere licencia de embedding, redistribución y subsetting. Una licencia retirada invalida nuevos exports, pero no borra automáticamente evidencia de entregas históricas. Para voz, avatar y retratos exigir permisos específicos. La generación IA no acredita originalidad ni exclusividad.

### 5.5 Identidad, aprobación y efectos

`WorkOrder → ResearchProposal → ConceptDraft → CDDRevision → RightsQA → BrandPolicyQA → HumanReview → ApprovalBinding → ExportIntent → Outbox → Render/ProviderReceipt → DeliveryAck`.

`ApprovalBinding` contiene tenant, actor, documento, revisión, hash, assets, derechos, destinatario, formato, coste y expiración. Cambios posteriores invalidan la aprobación. Un proveedor que devuelve 202 puede haber iniciado export, no completado entrega. Timeout tras efecto remoto → `OUTCOME_UNKNOWN`, reconciliar por identificador; no reintentar a ciegas. En entrega multiformato, conservar éxito/fallo por archivo y no volver a enviar los confirmados.

## 6. Integración con AgntiaPro y sus especialistas

**Padre `/agente`:** identidad canónica, LAIA, runtime, kernel, SOPs, policy, WorkOrders, approvals y eventos. Branding no crea otro supervisor ni otro scheduler de empleados. **Marketing:** estrategia comercial, campañas, audiencias; Branding custodia reglas y assets de marca. **Redes:** distribución social y adaptaciones; no redefine paleta sin aprobación. **Vídeo:** plantillas motion, lower thirds, presentadores y derechos. **Comunicación:** tono institucional y crisis. **Diseño:** ejecución de proyectos gráficos/UX cuando AuthorityMap lo asigne; Branding es autoridad del sistema de marca. **Clientes/Ventas:** materiales de atención y ofertas, sin duplicar CRM. **Legal:** marcas, claims, licencias y contratos. **Ciberseguridad:** sanitización de SVG, seguridad de plugins y credenciales. **Finanzas:** presupuesto y coste.

**AuthorityMap:** por `tenant + workOrder + resource + effect`. Branding puede generar y aprobar un kit; Vídeo compila motion; Redes publica. Ningún repo puede editar el brandbook de otro cliente por tener el mismo nombre de marca. El puente padre transmite referencias, no copias completas de memorias ni tokens OAuth.

## 7. Producto, UI y modelo comercial

**Workspaces:** Brand Executive Desk; Discovery & Market Research; Positioning Lab; Naming & Clearance; Brand Strategy; Identity Studio; Vector Editor; Typography Lab; Design Tokens; Components & Templates; Asset Rights; Brandbook; Review & Approval; Export & Delivery; Brand Drift; Agent Office; Cost & Reliability.

**Experiencia owner:** «Quiero una marca sobria para mi nueva empresa» produce preguntas y brief; después research con fuentes y limitaciones; tres rutas conceptuales con criterios; selección humana; sistema visual editable; previews web/social/vídeo; revisión de derechos; export con manifiesto y archivos fuente. No mostrar un logo raster como si fuese vector. La identidad verbal debe poder editarse y localizarse. El avatar Anam explica y presenta, pero no concede derechos ni registra marcas.

**Modelo:** servicio de consultoría/producción y mantenimiento de marca para empresas compiladas por AgntiaPro o clientes externos, con portal independiente. Presupuesto por proyecto y entregables, costes de generación y licencias explícitos. No inventar ahorros, cuota ni garantías de registro. La ventaja es el mantenimiento de identidad transversal, no competir por «logo en diez segundos».

## 8. Capacidades de destino: 100 especificaciones


### Investigación y estrategia
**BRA001 [DISEÑO]** Brief versionado con evidencia. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA002 [DISEÑO]** Mapa de stakeholders autorizados. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA003 [DISEÑO]** Auditoría de identidad existente. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA004 [DISEÑO]** Competitor identity map. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA005 [DISEÑO]** Brand Reality Graph. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA006 [DISEÑO]** Posicionamiento y diferenciación. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA007 [DISEÑO]** Arquitectura de marcas. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA008 [DISEÑO]** Segmentos y contextos culturales. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA009 [DISEÑO]** Estrategia de tono de voz. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA010 [DISEÑO]** Revisión estratégica humana. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.

### Naming y narrativa
**BRA011 [DISEÑO]** Generación de naming con criterios. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA012 [DISEÑO]** Filtro fonético multilingüe. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA013 [DISEÑO]** Análisis preliminar de conflictos. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA014 [DISEÑO]** Registro de fuentes de búsqueda. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA015 [DISEÑO]** Claims con provenance. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA016 [DISEÑO]** Storytelling y narrativa de marca. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA017 [DISEÑO]** Guía editorial y glosario. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA018 [DISEÑO]** Localización cultural. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA019 [DISEÑO]** Mensajes institucionales. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA020 [DISEÑO]** Clearance legal con escalado. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.

### Identidad visual
**BRA021 [DISEÑO]** Exploración de conceptos. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA022 [DISEÑO]** Logotipo vectorial editable. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA023 [DISEÑO]** Variantes responsive de logo. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA024 [DISEÑO]** Sistema cromático. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA025 [DISEÑO]** Tipografía y licencias. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA026 [DISEÑO]** Iconografía original. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA027 [DISEÑO]** Ilustración y patrones. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA028 [DISEÑO]** Fotografía y dirección de arte. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA029 [DISEÑO]** Composición y jerarquía. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA030 [DISEÑO]** Brand identity rationale. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.

### Documento y editor
**BRA031 [DISEÑO]** Canonical Design Document. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA032 [DISEÑO]** Árbol de nodos estable. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA033 [DISEÑO]** Constraints y layout engine. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA034 [DISEÑO]** Componentes y variantes. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA035 [DISEÑO]** Edición vectorial nominada. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA036 [DISEÑO]** Edición tipográfica exacta. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA037 [DISEÑO]** Import SVG saneado. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA038 [DISEÑO]** Import Penpot con mapping. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA039 [DISEÑO]** Versiones y semantic diff. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA040 [DISEÑO]** Colaboración y comentarios. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.

### Design systems
**BRA041 [DISEÑO]** DTCG token compiler. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA042 [DISEÑO]** Alias DAG y ciclos. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA043 [DISEÑO]** Semantic tokens por contexto. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA044 [DISEÑO]** Temas claro/oscuro. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA045 [DISEÑO]** Component token bindings. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA046 [DISEÑO]** Templates para canales. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA047 [DISEÑO]** Generación CSS/Tailwind. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA048 [DISEÑO]** Export JSON/Design Tokens. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA049 [DISEÑO]** Regresión de componentes. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA050 [DISEÑO]** Brand Genome Compiler. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.

### Producción multicanal
**BRA051 [DISEÑO]** Social templates. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA052 [DISEÑO]** Slides y documentos. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA053 [DISEÑO]** Email templates. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA054 [DISEÑO]** Landing UI kit. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA055 [DISEÑO]** Print/prepress kit. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA056 [DISEÑO]** Video lower thirds. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA057 [DISEÑO]** Motion brand pack. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA058 [DISEÑO]** Avatar/voz branding rules. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA059 [DISEÑO]** Materiales comerciales. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA060 [DISEÑO]** Multi-Channel Identity Compiler. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.

### Derechos y QA
**BRA061 [DISEÑO]** Asset Rights Passport. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA062 [DISEÑO]** Font License Vault. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA063 [DISEÑO]** Claims & Attribution Ledger. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA064 [DISEÑO]** SVG sanitization. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA065 [DISEÑO]** QA de contraste. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA066 [DISEÑO]** QA de layout/overflow. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA067 [DISEÑO]** QA de texto y Unicode. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA068 [DISEÑO]** QA de perfiles de color. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA069 [DISEÑO]** Pixel/semantic diff. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA070 [DISEÑO]** Reviewable QA report. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.

### Distribución y evolución
**BRA071 [DISEÑO]** Brandbook vivo. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA072 [DISEÑO]** Export Manifest firmado. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA073 [DISEÑO]** Release por versiones. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA074 [DISEÑO]** Asset distribution registry. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA075 [DISEÑO]** Brand Drift Observatory. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA076 [DISEÑO]** Retirada de assets obsoletos. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA077 [DISEÑO]** Impact map de cambios. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA078 [DISEÑO]** Reconciliación de entregas. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA079 [DISEÑO]** Procedural Design Memory. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA080 [DISEÑO]** Brand Evolution Simulator. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.

### Gobernanza y seguridad
**BRA081 [DISEÑO]** Supabase JWT/ACL. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA082 [DISEÑO]** RLS tenant/proyecto. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA083 [DISEÑO]** TwinBinding y mandato. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA084 [DISEÑO]** Approval hash-bound. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA085 [DISEÑO]** Outbox e idempotencia. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA086 [DISEÑO]** Secret vault de providers. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA087 [DISEÑO]** Control de plugins/MCP. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA088 [DISEÑO]** Presupuesto y rate limits. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA089 [DISEÑO]** Audit y provenance. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA090 [DISEÑO]** Backup/restore seguro. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.

### Evaluación y operación
**BRA091 [DISEÑO]** Graphic-Design-Bench-inspired tests. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA092 [DISEÑO]** GraphicBench-inspired workflows. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA093 [DISEÑO]** Designer-RSI replay gate. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA094 [DISEÑO]** Render reproducibility suite. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA095 [DISEÑO]** Two-tenant adversarial E2E. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA096 [DISEÑO]** Provider contract tests. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA097 [DISEÑO]** Human aesthetic review. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA098 [DISEÑO]** Cost & latency observatory. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA099 [DISEÑO]** Licensing compliance gates. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.
**BRA100 [DISEÑO]** Research-to-Product ledger. **Criterio:** entrada tipada, ownership, derechos, versión, salida editable o verificable, estado de error y gate documentado.

## 9. Evaluación de diseño, no solo de imagen

**DesignEvalSpec:** `{brief, referenceEvidence, constraints, requiredText, dimensions, assets, rights, allowedTools, expectedEditableNodes, outputFormats, reviewerRubric}`. Probar:
- **Geometría:** bounds, alineación, espaciado, solapamiento, safe areas, responsive y constraints.
- **Tipografía:** fidelidad literal, glifos, shaping, wrapping, line-height, kerning, fallback, bidi y fuentes licenciadas.
- **Vector y estructura:** SVG válido, nodos editables, paths, layers, jerarquía, componentes y ausencia de contenido activo.
- **Semántica:** mensaje, tono, claims, audiencia, brand fit, jerarquía y legibilidad.
- **Accesibilidad:** contraste, tamaños, alternativas, sensibilidad cultural y texto visible.
- **Derechos:** trazabilidad, licencias por uso, caducidad, consentimiento y restricciones.
- **Reproducibilidad:** render fijado, export por versión, hashes, fonts y diferencias declaradas.
- **Efectos:** aprobación exacta, export sandbox, publicación externa separada y ACK real.

**30 pruebas adversariales:** 1 JWT inválido; 2 tenantB lee diseñoA; 3 token de color filtra marcaB; 4 vector asset privado cruzado; 5 actor sin mandato; 6 aprobación revocada; 7 aprobación de revisión vieja; 8 fuente sin licencia; 9 font sin derecho de embedding; 10 marca similar a tercero sin revisión; 11 SVG con script; 12 SVG con entidad externa; 13 SVG con URL SSRF; 14 fuente con glyph fallback silencioso; 15 texto cambiado tras approval; 16 constraint cíclico; 17 node graph cíclico; 18 alias token cíclico; 19 export con fuente ausente; 20 diferencias CMYK/RGB; 21 clipping en formato vertical; 22 degradación de contraste; 23 import PDF/PSD no editable pero marcado editable; 24 plugin MCP intenta ejecutar código libre; 25 prompt injection en brief adjunto; 26 duplicado de entrega tras timeout; 27 dos workers compiten; 28 cambio de licencia entre cola y export; 29 restore revive aprobación retirada; 30 pixel diff aprobado pero texto erróneo.

**Gates críticos:** cero fugas de tenant, cero scripts ejecutables, cero export sin derechos requeridos, cero publicación sin aprobación, cero pérdida silenciosa de editabilidad, cero confusión entre preview y entrega. Para estética, revisión humana de muestras ciegas; para estructura, asserts deterministas. No usar un juez visual como única prueba de licencias, texto o seguridad.

## 10. Roadmap de convergencia — 12 olas

**G0 Research Atlas:** ampliar papers, 20 compañías, 15 repos, fuentes legales, formatos y licensing con fichas verificables.
**G1 Brand Domain:** briefs, strategy, policy, naming, assets, rights, tokens, DesignDocument y schemas.
**G2 Identity & Tenant:** Supabase, memberships, twins, mandatos, ACL/RLS y tests de fuga.
**G3 Editable Core:** CDD, nodos, constraints, revisions, renderer sandbox y fixtures.
**G4 Token Compiler:** DTCG, Style Dictionary, alias DAG, CSS/JSON y tests.
**G5 Editor Adapter:** Penpot aislado y primer flujo de edición nominada; evaluar Fabric/SVG-Edit.
**G6 Research & Strategy:** dossiers, naming, brand voice y revisión jurídica preliminar.
**G7 Creative SOPs:** diseño asistido, templates, skills, human review y replay.
**G8 Rights & QA:** fonts, licencias, SVG sanitization, pixel/semantic diff y accesibilidad.
**G9 Export & Distribution:** SVG/PNG/PDF/JSON, manifests, delivery receipts y handoffs.
**G10 Portal & Agency:** UI, LAIA, Anam, proyectos, costes, colaboración y reportes.
**G11 Reliability & V2:** seguridad, adversarial, restore, observabilidad, proveedores reales y reescritura basada en evidencia.

**No sustituir las 42 campañas.** Construir `BRAxxx → ADR → campaña → fase → patchset → archivo → test → reporte → gate`. Cada fase deja `NOT_STARTED/IN_PROGRESS/PASS/FAIL/BLOCKED/NOT_VERIFIED`, SHA, pruebas ejecutadas, diffs, riesgos, deuda y handoff.

**Árbol propuesto, no creado:** `packages/domain/src/{brand,rights,design,tokens}.ts`, `packages/renderer/src/{layout,fonts,svg,export}.ts`, `packages/qa/src/{geometry,typography,accessibility,rights}.ts`, `packages/providers/src/{penpot,figma,storage}.ts`, `apps/api/src/{auth,workorders,approvals,assets}.ts`, `apps/worker/src/{outbox,render,reconcile}.ts`, `apps/web/src/views/{BrandDesk,Research,Editor,Tokens,Brandbook}.tsx`, `tests/{unit,integration,e2e,adversarial,visual}/`. Elegir motor de edición por ADR; no instalar Penpot, Fabric y SVG-Edit simultáneamente por estética de cobertura.

## 11. Research backlog y decisiones abiertas

**Papers:** leer PDF y apéndices completos de Graphic-Design-Bench, Designer-RSI y GraphicBench; revisar datasets, licencias, métricas y reproducibilidad. **Repos:** inspeccionar código de Penpot API/MCP, Style Dictionary, Fabric, SVG-Edit, resvg, HarfBuzz y FontTools; ejecutar pruebas de integración por versión. **Empresas:** fichas reales de Figma, Canva, Adobe, Penpot, Frontify, Bynder y Zeroheight con API/edición/rights/pricing. **Legal:** Ley de Marcas española, OEPM, EUIPO, propiedad intelectual, derechos de imagen y voz; consulta profesional donde corresponda. **Diseño:** decidir CDD propio vs documento canónico Penpot; comparar pérdida de editabilidad, compatibilidad, coste, lock-in y seguridad. **Producto:** medir si el brandbook vivo y el control de drift reducen errores reales frente a una carpeta de assets.

**Preguntas falsables:** ¿cuánto texto exacto preserva cada renderer? ¿Qué porcentaje de nodos sigue editable tras round-trip? ¿Cuántos tokens se resuelven sin ciclos? ¿Cuánto cambia un render al actualizar fuente? ¿Cuántos usos incoherentes se detectan con precisión aceptable? ¿Puede el agente editar un archivo Penpot sin ejecutar código arbitrario? ¿Qué derechos faltan en assets de proveedores? ¿Qué coste por entrega editable y revisada se observa? No contestar con cifras inventadas.

## 12. Referencias y procedencia

**Fuentes externas consultadas:**
1. Graphic-Design-Bench: https://arxiv.org/abs/2604.04192
2. Designer-RSI: https://arxiv.org/abs/2609.22086
3. GraphicBench (investigación previa): https://arxiv.org/abs/2504.11571
4. Penpot repository: https://github.com/penpot/penpot
5. Penpot API/MCP/plugins: https://penpot.app/integrations-api
6. Penpot MCP architecture: https://github.com/penpot/penpot/blob/develop/mcp/README.md
7. Penpot Design Tokens: https://help.penpot.dev/user-guide/design-systems/design-tokens/
8. W3C DTCG: https://www.designtokens.org/
9. Ley de Marcas: https://www.boe.es/buscar/act.php?id=BOE-A-2001-23093
10. Propiedad intelectual: https://www.boe.es/buscar/act.php?id=BOE-A-1996-8930

**Fuentes internas inspeccionadas:** [README](../../README.md), [AGENTS](../../AGENTS.md), [producto](../01-producto.md), [investigación](../02-investigacion.md), [referentes](../03-referentes-y-brechas.md), [adaptadores](../04-adaptadores.md), [arquitectura](../architecture/01-arquitectura.md), [fuentes](../research/sources.json), [repositorios](../research/repositories.json).

**Límite epistemológico:** esta edición profundiza en investigación, contratos y pruebas, pero no declara una auditoría exhaustiva del código de las empresas, un benchmark reproducido ni un motor implementado. Los referentes no verificados son candidatos. Los resultados de papers pertenecen a sus autores. El siguiente avance técnico requiere ejecutar pruebas y registrar resultados reales.
