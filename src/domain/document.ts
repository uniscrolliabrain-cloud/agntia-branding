import { z } from "zod";
import { contentHash } from "../contracts/evidence.ts";
import { DomainError } from "../contracts/errors.ts";

/**
 * The structured design document is the canonical editable artifact; the render
 * is a verifiable projection of it. The document carries its nodes, constraints,
 * text sources and the engine/font hashes used, so two renders of the same
 * version can be compared instead of trusted.
 */

export const designNodeSchema = z
  .object({
    id: z.string().min(1).max(64),
    kind: z.enum(["text", "rect", "ellipse", "path", "image", "group"]),
    x: z.number(),
    y: z.number(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
    /** Text content must reference an approved source, not free model prose. */
    textRef: z.string().min(1).max(128).nullable(),
    fontRef: z.string().min(1).max(128).nullable(),
    fill: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
    locked: z.boolean(),
  })
  .strict();

export type DesignNode = z.infer<typeof designNodeSchema>;

export const designDocumentSchema = z
  .object({
    id: z.string().min(1).max(128),
    tenantId: z.string().min(1).max(128),
    version: z.number().int().nonnegative(),
    nodes: z.array(designNodeSchema).max(512),
    /** Approved text sources by ref. Rendering free text is a policy violation. */
    textSources: z.record(z.string()),
    engine: z.string().min(1).max(64),
    engineVersion: z.string().min(1).max(32),
    fontHash: z.string().regex(/^[a-f0-9]{64}$/),
    constraints: z.array(z.string().max(128)).max(64),
  })
  .strict();

export type DesignDocument = z.infer<typeof designDocumentSchema>;

export interface NodePatch {
  nodeId: string;
  changes: Partial<Pick<DesignNode, "x" | "y" | "width" | "height" | "fill" | "textRef">>;
}

/**
 * Compare-and-swap update. Two editors on the same version produce one winner
 * and one 409, never a silent last-write-wins that loses work.
 */
export function updateDocument(
  document: DesignDocument,
  patches: readonly NodePatch[],
  expectedVersion: number,
): DesignDocument {
  if (document.version !== expectedVersion) {
    throw new DomainError("version_conflict", "The document changed since you loaded it.", {
      details: { currentVersion: document.version, expectedVersion },
    });
  }
  const nodes = document.nodes.map((node) => {
    const patch = patches.find((p) => p.nodeId === node.id);
    if (!patch) return node;
    if (node.locked) {
      throw new DomainError("policy_violation", "The node is locked and cannot be edited.", {
        details: { nodeId: node.id, reason: "node_locked" },
      });
    }
    return designNodeSchema.parse({ ...node, ...patch.changes });
  });

  const unknown = patches.find((p) => !document.nodes.some((n) => n.id === p.nodeId));
  if (unknown) {
    throw new DomainError("invalid_input", "The patch targets an unknown node.", { details: { nodeId: unknown.nodeId } });
  }

  return designDocumentSchema.parse({
    ...document,
    version: document.version + 1,
    nodes,
  });
}

export interface DocumentDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

export function diffDocuments(before: DesignDocument, after: DesignDocument): DocumentDiff {
  const beforeIds = new Set(before.nodes.map((n) => n.id));
  const afterIds = new Set(after.nodes.map((n) => n.id));
  const added = [...afterIds].filter((id) => !beforeIds.has(id)).sort();
  const removed = [...beforeIds].filter((id) => !afterIds.has(id)).sort();
  const changed = after.nodes
    .filter((node) => {
      const previous = before.nodes.find((n) => n.id === node.id);
      return previous !== undefined && contentHash(previous) !== contentHash(node);
    })
    .map((n) => n.id)
    .sort();
  return { added, removed, changed };
}

/**
 * Deterministic render identity: same document + engine + fonts => same hash.
 * A different hash means the render cannot be attributed to this version.
 */
export function renderIdentity(document: DesignDocument): string {
  return contentHash({
    document: contentHash(document),
    engine: document.engine,
    engineVersion: document.engineVersion,
    fontHash: document.fontHash,
  });
}

export function documentHash(document: DesignDocument): string {
  return contentHash(document);
}

/** Every text node must resolve to an approved source. */
export function assertTextNodesResolvable(document: DesignDocument): void {
  for (const node of document.nodes) {
    if (node.kind !== "text") continue;
    if (node.textRef === null) {
      throw new DomainError("policy_violation", "A text node must reference an approved text source.", {
        details: { nodeId: node.id, reason: "text_without_source" },
      });
    }
    if (document.textSources[node.textRef] === undefined) {
      throw new DomainError("invalid_input", "The text source is missing from the document.", {
        details: { nodeId: node.id, textRef: node.textRef },
      });
    }
  }
}
