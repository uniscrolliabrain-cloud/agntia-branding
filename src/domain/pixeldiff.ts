import { DomainError } from "../contracts/errors.ts";
import { diffDocuments, type DesignDocument, type DesignNode } from "./document.ts";
import { rasterizeDocument } from "./render.ts";

/**
 * Fidelity is measured, not asserted.
 *
 * A document diff says which nodes changed; a pixel diff says whether the change
 * is visible and where. A change that never reaches the pixels is a silent
 * defect: the designer edited something, approved it, and the deliverable looks
 * identical. This module compares two rasterizations with a declared tolerance
 * and reports both the differing region and the changed nodes that the pixels do
 * not explain.
 *
 * It is not a vision judge: it cannot say whether the design is good, only
 * whether two renders differ and where.
 */

export interface PixelDiffInput {
  dpi: number;
  /** Maximum per-channel difference treated as equal. Declared, never assumed. */
  tolerance?: number;
}

export interface PixelDiff {
  width: number;
  height: number;
  totalPixels: number;
  differingPixels: number;
  /** 0..1 over the pixels that exceed the tolerance. */
  ratio: number;
  tolerance: number;
  withinTolerance: boolean;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  /** Nodes the document diff reports as changed but the pixels do not show. */
  unexplainedChanges: string[];
  findings: string[];
}

export const DEFAULT_TOLERANCE = 2;

function nodeBox(node: DesignNode): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: node.x, y0: node.y, x1: node.x + node.width, y1: node.y + node.height };
}

function overlaps(
  a: { x0: number; y0: number; x1: number; y1: number },
  b: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/**
 * Compare two renders of the same page.
 *
 * Different DPI is rejected rather than averaged: comparing a 96 dpi and a 300
 * dpi render would produce a diff that means nothing.
 */
export function diffRenders(before: DesignDocument, after: DesignDocument, input: PixelDiffInput): PixelDiff {
  const tolerance = input.tolerance ?? DEFAULT_TOLERANCE;
  if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255) {
    throw new DomainError("invalid_input", "The tolerance must be an integer between 0 and 255.");
  }
  if (!Number.isFinite(input.dpi) || input.dpi <= 0) {
    throw new DomainError("invalid_input", "The DPI must be positive.");
  }

  const a = rasterizeDocument(before, input.dpi);
  const b = rasterizeDocument(after, input.dpi);
  if (a.width !== b.width || a.height !== b.height) {
    throw new DomainError("invalid_input", "The two renders do not share a canvas size.", {
      details: { before: `${a.width}x${a.height}`, after: `${b.width}x${b.height}` },
    });
  }

  let differing = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      const offset = (y * a.width + x) * 4;
      const delta = Math.max(
        Math.abs((a.data[offset] as number) - (b.data[offset] as number)),
        Math.abs((a.data[offset + 1] as number) - (b.data[offset + 1] as number)),
        Math.abs((a.data[offset + 2] as number) - (b.data[offset + 2] as number)),
      );
      if (delta <= tolerance) continue;
      differing += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const totalPixels = a.width * a.height;
  const boundingBox =
    differing === 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };

  const documentDiff = diffDocuments(before, after);
  const scale = input.dpi / 96;
  const unexplainedChanges = [...documentDiff.changed, ...documentDiff.added].filter((nodeId) => {
    const boxes = [before.nodes.find((n) => n.id === nodeId), after.nodes.find((n) => n.id === nodeId)]
      .filter((node): node is DesignNode => node !== undefined)
      .map((node) => {
        const box = nodeBox(node);
        return { x0: box.x0 * scale, y0: box.y0 * scale, x1: box.x1 * scale, y1: box.y1 * scale };
      });
    if (boxes.length === 0) return true;
    if (boundingBox === null) return true;
    const region = {
      x0: boundingBox.x,
      y0: boundingBox.y,
      x1: boundingBox.x + boundingBox.width,
      y1: boundingBox.y + boundingBox.height,
    };
    return !boxes.some((box) => overlaps(box, region));
  });

  const findings = [...new Set([...a.findings, ...b.findings])].sort();
  if (unexplainedChanges.length > 0) findings.push(`invisible_change:${unexplainedChanges.join(",")}`);

  return {
    width: a.width,
    height: a.height,
    totalPixels,
    differingPixels: differing,
    ratio: totalPixels === 0 ? 0 : differing / totalPixels,
    tolerance,
    withinTolerance: differing === 0,
    boundingBox,
    unexplainedChanges: unexplainedChanges.sort(),
    findings,
  };
}

/**
 * QA gate: a render that changed without exceeding the tolerance is not a pass,
 * and a changed node that never appeared in the pixels is a defect to fix, not a
 * warning to hide.
 */
export function assertRenderChangeVisible(diff: PixelDiff): void {
  // The specific reason wins: naming the node is more useful than "nothing moved".
  if (diff.unexplainedChanges.length > 0) {
    throw new DomainError("policy_violation", "A changed node does not appear where it should.", {
      details: { reason: "invisible_change", nodes: diff.unexplainedChanges.join(",") },
    });
  }
  if (diff.differingPixels === 0) {
    throw new DomainError("policy_violation", "The approved change produced no visible difference.", {
      details: { reason: "pixel_identical", tolerance: diff.tolerance },
    });
  }
}
