// Post-evaluation analysis: detect gaps between groups declared with `connect`

import type { ASTNode, ModelNode } from "../ast/nodes.js";
import type { MeshGroup } from "../mesh/builder.js";

export interface ConnectivityWarning {
  groupA: string;
  groupB: string;
  parentPath: string;
  minDistance: number;
  loc?: { line: number; col: number };
}

// ── AST extraction ──────────────────────────────────────────────────

interface ConnectDecl {
  groupA: string;
  groupB: string;
  /** Path of group names leading to the scope where this connect lives */
  scopePath: string[];
  loc?: { line: number; col: number };
}

/** Walk the AST and collect all `connect` declarations with their scope path. */
function collectConnectDecls(ast: ModelNode): ConnectDecl[] {
  const decls: ConnectDecl[] = [];

  function walk(nodes: ASTNode[], scopePath: string[]) {
    for (const node of nodes) {
      if (node.type === "connect") {
        decls.push({
          groupA: node.groupA,
          groupB: node.groupB,
          scopePath,
          loc: node.loc,
        });
      } else if (node.type === "group") {
        walk(node.body, [...scopePath, node.name]);
      } else if (node.type === "mirror") {
        walk(node.body, scopePath);
      }
    }
  }

  walk(ast.body, []);
  return decls;
}

// ── Geometry helpers ────────────────────────────────────────────────

/** Collect all vertex positions from a group and its descendants. */
function collectPositions(group: MeshGroup): number[] {
  const out: number[] = [];
  for (const p of group.primitives) {
    out.push(...p.positions);
  }
  for (const child of group.children) {
    out.push(...collectPositions(child));
  }
  return out;
}

/** Compute minimum distance between two position arrays. */
function minDistanceBetween(posA: number[], posB: number[]): number {
  let best = Infinity;
  for (let i = 0; i < posA.length; i += 3) {
    for (let j = 0; j < posB.length; j += 3) {
      const d2 =
        (posA[i] - posB[j]) ** 2 +
        (posA[i + 1] - posB[j + 1]) ** 2 +
        (posA[i + 2] - posB[j + 2]) ** 2;
      if (d2 < best) best = d2;
    }
  }
  return Math.sqrt(best);
}

/** Check if any vertex in posA is within eps of any vertex in posB using a spatial hash. */
function areConnected(posA: number[], posB: number[], eps: number): boolean {
  if (posA.length === 0 || posB.length === 0) return false;

  const eps2 = eps * eps;

  // Build spatial hash from posA
  const hash = new Map<string, number[]>();
  for (let i = 0; i < posA.length; i += 3) {
    const key = `${Math.floor(posA[i] / eps)},${Math.floor(posA[i + 1] / eps)},${Math.floor(posA[i + 2] / eps)}`;
    let bucket = hash.get(key);
    if (!bucket) { bucket = []; hash.set(key, bucket); }
    bucket.push(i);
  }

  // Probe with posB
  for (let i = 0; i < posB.length; i += 3) {
    const bx = posB[i], by = posB[i + 1], bz = posB[i + 2];
    const cx = Math.floor(bx / eps);
    const cy = Math.floor(by / eps);
    const cz = Math.floor(bz / eps);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = hash.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!bucket) continue;
          for (const ai of bucket) {
            const d2 = (posA[ai] - bx) ** 2 + (posA[ai + 1] - by) ** 2 + (posA[ai + 2] - bz) ** 2;
            if (d2 <= eps2) return true;
          }
        }
      }
    }
  }
  return false;
}

// ── Mesh tree traversal ─────────────────────────────────────────────

/** Find a child MeshGroup by name within a parent. */
function findChild(parent: MeshGroup, name: string): MeshGroup | undefined {
  return parent.children.find(c => c.name === name);
}

/** Resolve a scope path to a MeshGroup node. */
function resolveScope(root: MeshGroup, scopePath: string[]): MeshGroup | undefined {
  let current = root;
  for (const name of scopePath) {
    const child = findChild(current, name);
    if (!child) return undefined;
    current = child;
  }
  return current;
}

// ── Public API ──────────────────────────────────────────────────────

const DEFAULT_EPSILON = 0.01;

export function checkConnectivity(
  ast: ModelNode,
  root: MeshGroup,
  epsilon: number = DEFAULT_EPSILON,
): ConnectivityWarning[] {
  const decls = collectConnectDecls(ast);
  const warnings: ConnectivityWarning[] = [];

  for (const decl of decls) {
    const scope = resolveScope(root, decl.scopePath);
    if (!scope) continue;

    const groupA = findChild(scope, decl.groupA);
    const groupB = findChild(scope, decl.groupB);

    if (!groupA) {
      warnings.push({
        groupA: decl.groupA,
        groupB: decl.groupB,
        parentPath: decl.scopePath.length > 0 ? decl.scopePath.join(" > ") : root.name,
        minDistance: -1,
        loc: decl.loc,
      });
      continue;
    }
    if (!groupB) {
      warnings.push({
        groupA: decl.groupA,
        groupB: decl.groupB,
        parentPath: decl.scopePath.length > 0 ? decl.scopePath.join(" > ") : root.name,
        minDistance: -1,
        loc: decl.loc,
      });
      continue;
    }

    const posA = collectPositions(groupA);
    const posB = collectPositions(groupB);

    if (!areConnected(posA, posB, epsilon)) {
      const dist = minDistanceBetween(posA, posB);
      warnings.push({
        groupA: decl.groupA,
        groupB: decl.groupB,
        parentPath: decl.scopePath.length > 0 ? decl.scopePath.join(" > ") : root.name,
        minDistance: dist,
        loc: decl.loc,
      });
    }
  }

  return warnings;
}
