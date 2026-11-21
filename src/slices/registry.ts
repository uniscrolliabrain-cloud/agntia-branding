import { BRAND_CAPABILITY_NAMES, type BrandCapability } from "../contracts/capabilities.ts";
import { DomainError } from "../contracts/errors.ts";

/**
 * Vertical slices.
 *
 * A slice is the smallest shippable unit of the product: the capabilities one
 * end-to-end vertical needs, not the whole registry. Slices are declared here
 * with an activation state and are switched on by configuration, never by a
 * hidden code path:
 *
 *   active   implemented and enabled by default
 *   ready    implemented, deliberately off until its dependencies exist
 *   blocked  cannot be enabled at all; a provider or a contract is missing
 *
 * Enabling a `blocked` slice is an error, not a warning: a half-wired slice that
 * answers anyway is exactly the failure mode this program forbids. The PEP reads
 * the resolved activation on every call, so a capability that belongs to a slice
 * nobody activated is denied with `unsupported_capability`.
 */

export const SLICE_STATUSES = ["active", "ready", "blocked"] as const;
export type SliceStatus = (typeof SLICE_STATUSES)[number];

export const SLICE_IDS = [
  "brief",
  "identity",
  "design",
  "rights",
  "documents",
  "tokens",
  "qa",
  "brandbook",
  "research",
  "export",
  "delivery",
  "learning",
  "penpot",
] as const;
export type SliceId = (typeof SLICE_IDS)[number];

export interface SliceSpec {
  readonly id: SliceId;
  readonly title: string;
  readonly status: SliceStatus;
  readonly capabilities: readonly BrandCapability[];
  /** Campaigns this slice implements, from docs/campaigns/campaign.json. */
  readonly campaigns: readonly string[];
  /** Why the slice cannot be enabled yet. Empty for active and ready slices. */
  readonly blockers: readonly string[];
  /** The concrete next step that makes the slice real. */
  readonly nextStep: string;
}

export const SLICES: readonly SliceSpec[] = [
  {
    id: "brief",
    title: "Brief y estrategia",
    status: "active",
    capabilities: ["brand.brief.propose"],
    campaigns: ["BRD-C09"],
    blockers: [],
    nextStep: "Editar el brief desde el portal y versionarlo con aprobación.",
  },
  {
    id: "identity",
    title: "Identidad verbal y naming",
    status: "active",
    capabilities: ["brand.naming.propose", "brand.voice.propose"],
    campaigns: ["BRD-C11", "BRD-C13"],
    blockers: [],
    nextStep: "Conectar el gateway de modelos para proponer candidatos; el veredicto sigue siendo humano.",
  },
  {
    id: "design",
    title: "Conceptos, logotipo y composición",
    status: "active",
    capabilities: [
      "brand.concept.preview",
      "brand.logo.propose",
      "brand.design.preview",
      "brand.layout.validate",
      "brand.template.propose",
    ],
    campaigns: ["BRD-C14", "BRD-C17", "BRD-C19", "BRD-C20", "BRD-C24", "BRD-C25", "BRD-C26"],
    blockers: [],
    nextStep: "Ampliar el renderer a path e imagen para que ningún nodo quede fuera del documento.",
  },
  {
    id: "rights",
    title: "Derechos de activos y fuentes",
    status: "active",
    capabilities: ["brand.rights.read", "brand.font.preview"],
    campaigns: ["BRD-C15", "BRD-C16"],
    blockers: [],
    nextStep: "Leer licencias por familia tipográfica en lugar de mantenerlas como UNKNOWN.",
  },
  {
    id: "documents",
    title: "Documento editable y canvas",
    status: "active",
    capabilities: ["brand.document.update", "brand.canvas.preview"],
    campaigns: ["BRD-C17", "BRD-C19"],
    blockers: [],
    nextStep: "Sustituir el editor interno por el canvas aprobado cuando exista motor vectorial completo.",
  },
  {
    id: "tokens",
    title: "Paleta y design tokens",
    status: "active",
    capabilities: ["brand.palette.validate", "brand.tokens.preview", "brand.tokens.export"],
    campaigns: ["BRD-C21", "BRD-C22", "BRD-C23"],
    blockers: [],
    nextStep: "Generar Style Dictionary real desde el token set aprobado.",
  },
  {
    id: "qa",
    title: "QA de texto y revisión visual",
    status: "active",
    capabilities: ["brand.text.verify", "brand.quality.evaluate"],
    campaigns: ["BRD-C27", "BRD-C28"],
    blockers: [],
    nextStep: "Añadir un juez de visión con presupuesto y revisión humana del diff.",
  },
  {
    id: "brandbook",
    title: "Brandbook y reglas",
    status: "active",
    capabilities: ["brand.brandbook.propose"],
    campaigns: ["BRD-C29"],
    blockers: [],
    nextStep: "Componer el brandbook desde el documento y los tokens ya aprobados.",
  },
  {
    id: "research",
    title: "Investigación y clearance",
    status: "ready",
    capabilities: ["brand.research.preview", "brand.clearance.preview"],
    campaigns: ["BRD-C10", "BRD-C12"],
    blockers: [
      "Sin corpus de fuentes autorizado (allowlist) ni proveedor de investigación.",
      "Sin registro de marcas conectado: el clearance sigue siendo preliminar y humano.",
    ],
    nextStep: "Definir la allowlist de fuentes y ejecutar safeFetch contra un corpus real y citado.",
  },
  {
    id: "export",
    title: "Export y preflight",
    status: "ready",
    capabilities: ["brand.export.preview"],
    campaigns: ["BRD-C30"],
    blockers: [
      "La ruta HTTP brand.export.preview no está cableada: falta resolver el recurso de documento y el flujo de aprobación.",
      "El renderer sólo dibuja rect, ellipse y text; path, image y group fallan cerrado.",
    ],
    nextStep: "Cablear la descarga autenticada por tenant sobre el renderer y el manifiesto ya existentes.",
  },
  {
    id: "delivery",
    title: "Entrega y publicación",
    status: "ready",
    capabilities: ["brand.deliver.propose"],
    campaigns: ["BRD-C31"],
    blockers: [
      "Sin canal de entrega configurado ni binding de proveedor.",
      "Publicar o enviar a un destinatario real exige autorización explícita del owner.",
    ],
    nextStep: "Implementar la entrega al sandbox con recibo firmado y reconciliación.",
  },
  {
    id: "learning",
    title: "Aprendizaje y librería",
    status: "ready",
    capabilities: ["brand.learning.propose"],
    campaigns: ["BRD-C32"],
    blockers: [
      "Sin conjunto de datos consentido y agregado; aprender de materiales de cliente exige base legal.",
    ],
    nextStep: "Construir el pipeline de propuestas con consentimiento por tenant y revisión humana.",
  },
  {
    id: "penpot",
    title: "Workspace Penpot",
    status: "blocked",
    capabilities: ["brand.penpot.preview"],
    campaigns: ["BRD-C18"],
    blockers: [
      "Sin instancia Penpot, sin OAuth y sin verificación de ACL remota.",
      "Un workspace remoto no es un tenant local: el binding de fichero debe ser de servidor.",
    ],
    nextStep: "Sólo cuando exista instancia: verificar runtime y fijar fileRevision antes de abrir nada.",
  },
];

const BY_ID = new Map<string, SliceSpec>(SLICES.map((slice) => [slice.id as string, slice]));

/** Which slice declares a capability, independently of whether it is enabled. */
const DECLARED_BY = new Map<string, SliceId>();
for (const slice of SLICES) {
  for (const capability of slice.capabilities) DECLARED_BY.set(capability, slice.id);
}

export function getSlice(id: string): SliceSpec | undefined {
  return BY_ID.get(id);
}

export function sliceDeclaring(capability: string): SliceId | undefined {
  return DECLARED_BY.get(capability);
}

/** Slices that are on when nothing is configured. */
export const DEFAULT_ACTIVE_SLICE_IDS: readonly SliceId[] = SLICES.filter((s) => s.status === "active").map(
  (s) => s.id,
);

/**
 * A resolved activation: which slices are on and, derived from them, which
 * capabilities may be invoked. The map is the only thing the PEP consults.
 */
export class SliceActivation {
  readonly requestedSlices: readonly string[] | null;
  readonly slices: readonly SliceId[];
  readonly capabilities: ReadonlySet<BrandCapability>;
  readonly #sliceByCapability: ReadonlyMap<string, SliceId>;

  constructor(slices: readonly SliceId[], requestedSlices: readonly string[] | null = null) {
    const byCapability = new Map<string, SliceId>();
    for (const id of slices) {
      const spec = BY_ID.get(id);
      if (!spec) throw new DomainError("invalid_input", "Unknown slice.", { details: { slice: id } });
      for (const capability of spec.capabilities) {
        if (byCapability.has(capability)) {
          throw new DomainError("internal_error", "A capability is declared by two slices.", {
            details: { capability, slice: id },
          });
        }
        byCapability.set(capability, id);
      }
    }
    this.slices = Object.freeze([...slices]);
    this.capabilities = new Set(byCapability.keys()) as ReadonlySet<BrandCapability>;
    this.#sliceByCapability = byCapability;
    this.requestedSlices = requestedSlices === null ? null : Object.freeze([...requestedSlices]);
  }

  isCapabilityEnabled(capability: string): boolean {
    return this.#sliceByCapability.has(capability);
  }

  sliceOf(capability: string): SliceId | undefined {
    return this.#sliceByCapability.get(capability);
  }
}

/**
 * Resolve the activation from an explicit list. `null`/`undefined` means "the
 * default set". `[]` is rejected: an accidentally empty list must not silently
 * behave like the default or like "everything off".
 */
export function resolveActivation(requested?: readonly string[] | null): SliceActivation {
  if (requested === undefined || requested === null) {
    return new SliceActivation(DEFAULT_ACTIVE_SLICE_IDS);
  }
  if (requested.length === 0) {
    throw new DomainError("invalid_input", "The slice list is empty. Omit it to use the default activation.", {
      details: { reason: "empty_slice_list" },
    });
  }
  const enabled: SliceId[] = [];
  for (const raw of requested) {
    const id = raw.trim();
    const spec = BY_ID.get(id);
    if (!spec) {
      throw new DomainError("invalid_input", "Unknown slice.", {
        details: { slice: id, known: SLICE_IDS.join(",") },
      });
    }
    if (spec.status === "blocked") {
      throw new DomainError("policy_violation", "This slice is blocked and cannot be activated.", {
        details: { slice: spec.id, blockers: spec.blockers.join(" | ") },
      });
    }
    if (!enabled.includes(spec.id)) enabled.push(spec.id);
  }
  return new SliceActivation(enabled, requested);
}

/**
 * Structural validation, used by the repository invariants and the tests. It
 * answers one question: does the registry describe every capability exactly
 * once, with a coherent status?
 */
export function validateSliceRegistry(): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();

  for (const slice of SLICES) {
    if (slice.capabilities.length === 0) problems.push(`${slice.id}: declara cero capacidades`);
    // Active slices must not carry blockers; ready and blocked ones must.
    if (slice.status === "active" && slice.blockers.length > 0) {
      problems.push(`${slice.id}: active con blockers declarados`);
    }
    if (slice.status !== "active" && slice.blockers.length === 0) {
      problems.push(`${slice.id}: ${slice.status} sin blocker declarado`);
    }
    if (slice.nextStep.trim() === "") problems.push(`${slice.id}: sin nextStep`);
    for (const capability of slice.capabilities) {
      const previous = seen.get(capability);
      if (previous !== undefined) problems.push(`${capability}: declarada en ${previous} y en ${slice.id}`);
      seen.set(capability, slice.id);
    }
  }

  for (const capability of BRAND_CAPABILITY_NAMES) {
    if (!seen.has(capability)) problems.push(`${capability}: no pertenece a ninguna slice`);
  }
  return problems;
}
