import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import type { ModelNode, ASTNode } from "../ast/nodes.js";
import { evaluate } from "../interpreter/evaluator.js";
import type { MeshPrimitive, MeshGroup } from "../mesh/builder.js";

// Collect all primitives from a mesh group tree
function collectPrimitives(group: MeshGroup): MeshPrimitive[] {
  const result = [...group.primitives];
  for (const child of group.children) {
    result.push(...collectPrimitives(child));
  }
  return result;
}

// Compute the signed volume of a triangle mesh using the divergence theorem.
// For a closed mesh with outward-facing (CCW) normals, the result is positive
// and equals the enclosed volume. Inverted normals produce negative contributions.
function signedVolume(prim: MeshPrimitive): number {
  let vol = 0;
  for (let i = 0; i < prim.indices.length; i += 3) {
    const ai = prim.indices[i],
      bi = prim.indices[i + 1],
      ci = prim.indices[i + 2];
    const ax = prim.positions[ai * 3],
      ay = prim.positions[ai * 3 + 1],
      az = prim.positions[ai * 3 + 2];
    const bx = prim.positions[bi * 3],
      by = prim.positions[bi * 3 + 1],
      bz = prim.positions[bi * 3 + 2];
    const cx = prim.positions[ci * 3],
      cy = prim.positions[ci * 3 + 1],
      cz = prim.positions[ci * 3 + 2];
    // a · (b × c)
    vol +=
      ax * (by * cz - bz * cy) +
      ay * (bz * cx - bx * cz) +
      az * (bx * cy - by * cx);
  }
  return vol / 6;
}

// Verify all normals are consistent: signed volume should match expected
// geometric volume within tolerance. If any normals are inverted, the signed
// volume will be lower than expected (possibly negative).
function assertNormalsCorrect(
  prims: MeshPrimitive[],
  expectedVolume: number,
  label: string
) {
  let totalVol = 0;
  for (const prim of prims) {
    totalVol += signedVolume(prim);
  }
  assert.ok(
    totalVol > 0,
    `${label}: signed volume should be positive, got ${totalVol}`
  );
  const relError = Math.abs(totalVol - expectedVolume) / expectedVolume;
  assert.ok(
    relError < 0.01,
    `${label}: signed volume ${totalVol.toFixed(6)} should be close to expected ${expectedVolume.toFixed(6)} (error: ${(relError * 100).toFixed(1)}%)`
  );
}

// Wrap body nodes into a model AST
function model(name: string, body: ASTNode[]): ModelNode {
  return { type: "model", name, body };
}

describe("mirror normals", () => {
  it("face -Y with mirror x: all normals point outward", () => {
    // Reproduces the table-leg scenario: face downward, then mirror x
    const size = 0.2;
    const dist = 1;
    const ast = model("test", [
      { type: "profile_builtin", shape: "square", args: [size] },
      { type: "face", direction: [0, -1, 0] },
      {
        type: "mirror",
        axes: ["x"],
        body: [
          { type: "move", position: [1, 0.5, 0] },
          { type: "draw_distance", distance: dist },
        ],
      },
    ]);

    const builder = evaluate(ast);
    const prims = collectPrimitives(builder.getRoot());
    assert.ok(prims.length > 0, "should produce geometry");
    // 2 copies × size² × distance
    assertNormalsCorrect(prims, 2 * size * size * dist, "mirror x face -Y");
  });

  it("face -Y with mirror x z (table legs): all normals point outward", () => {
    const size = 0.15;
    const dist = 2.65;
    const ast = model("test", [
      { type: "profile_builtin", shape: "square", args: [size] },
      { type: "face", direction: [0, -1, 0] },
      {
        type: "mirror",
        axes: ["x", "z"],
        body: [
          { type: "move", position: [1.3, 0.65, 0.6] },
          { type: "draw_distance", distance: dist },
        ],
      },
    ]);

    const builder = evaluate(ast);
    const prims = collectPrimitives(builder.getRoot());
    assert.ok(prims.length > 0, "should produce geometry");
    // 4 copies (2^2 combos for mirror x z)
    assertNormalsCorrect(
      prims,
      4 * size * size * dist,
      "mirror x z face -Y"
    );
  });

  it("face +Y with mirror x: normals remain correct", () => {
    const size = 0.2;
    const dist = 1;
    const ast = model("test", [
      { type: "profile_builtin", shape: "square", args: [size] },
      {
        type: "mirror",
        axes: ["x"],
        body: [
          { type: "move", position: [1, 0, 0] },
          { type: "draw_distance", distance: dist },
        ],
      },
    ]);

    const builder = evaluate(ast);
    const prims = collectPrimitives(builder.getRoot());
    assert.ok(prims.length > 0, "should produce geometry");
    assertNormalsCorrect(prims, 2 * size * size * dist, "mirror x face +Y");
  });

  it("face diagonal with mirror x: normals point outward", () => {
    const size = 0.15;
    const dist = 1;
    const ast = model("test", [
      { type: "profile_builtin", shape: "square", args: [size] },
      { type: "face", direction: [1, -1, 0] },
      {
        type: "mirror",
        axes: ["x"],
        body: [
          { type: "move", position: [1, 1, 0] },
          { type: "draw_distance", distance: dist },
        ],
      },
    ]);

    const builder = evaluate(ast);
    const prims = collectPrimitives(builder.getRoot());
    assert.ok(prims.length > 0);
    assertNormalsCorrect(prims, 2 * size * size * dist, "mirror x face diagonal");
  });

  it("face +Z with mirror z: normals point outward", () => {
    const size = 0.2;
    const dist = 1;
    const ast = model("test", [
      { type: "profile_builtin", shape: "square", args: [size] },
      { type: "face", direction: [0, 0, 1] },
      {
        type: "mirror",
        axes: ["z"],
        body: [
          { type: "move", position: [0, 0, 1] },
          { type: "draw_distance", distance: dist },
        ],
      },
    ]);

    const builder = evaluate(ast);
    const prims = collectPrimitives(builder.getRoot());
    assert.ok(prims.length > 0);
    assertNormalsCorrect(prims, 2 * size * size * dist, "mirror z face +Z");
  });

  it("mirrored geometry is a true reflection of the original", () => {
    const ast = model("test", [
      { type: "profile_builtin", shape: "square", args: [0.3] },
      { type: "face", direction: [0, -1, 0] },
      {
        type: "mirror",
        axes: ["x"],
        body: [
          { type: "move", position: [2, 0, 0] },
          { type: "draw_distance", distance: 1 },
        ],
      },
    ]);

    const builder = evaluate(ast);
    const prims = collectPrimitives(builder.getRoot());
    assert.equal(prims.length, 1);

    const prim = prims[0];
    const vertCount = prim.positions.length / 3;

    // Split vertices into x>0 (original) and x<0 (reflected)
    const origVerts = new Set<string>();
    const reflVerts = new Set<string>();
    for (let i = 0; i < vertCount; i++) {
      const x = prim.positions[i * 3];
      const y = prim.positions[i * 3 + 1];
      const z = prim.positions[i * 3 + 2];
      const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
      if (x > 0) origVerts.add(key);
      else reflVerts.add(key);
    }

    for (const v of origVerts) {
      const [xs, ys, zs] = v.split(",");
      const reflected = `${(-parseFloat(xs)).toFixed(6)},${ys},${zs}`;
      assert.ok(
        reflVerts.has(reflected),
        `missing reflected vertex for ${v}: expected ${reflected}`
      );
    }
  });

  it("nested mirror: face -Y with mirror x inside mirror z", () => {
    const size = 0.1;
    const dist = 1;
    const ast = model("test", [
      { type: "profile_builtin", shape: "square", args: [size] },
      { type: "face", direction: [0, -1, 0] },
      {
        type: "mirror",
        axes: ["z"],
        body: [
          {
            type: "mirror",
            axes: ["x"],
            body: [
              { type: "move", position: [1, 0.5, 1] },
              { type: "draw_distance", distance: dist },
            ],
          },
        ],
      },
    ]);

    const builder = evaluate(ast);
    const prims = collectPrimitives(builder.getRoot());
    assert.ok(prims.length > 0);
    // 4 copies (2 × 2)
    assertNormalsCorrect(prims, 4 * size * size * dist, "nested mirror");
  });

  it("no mirror: face -Y normals are correct (baseline)", () => {
    const size = 0.2;
    const dist = 1;
    const ast = model("test", [
      { type: "profile_builtin", shape: "square", args: [size] },
      { type: "face", direction: [0, -1, 0] },
      { type: "move", position: [0, 1, 0] },
      { type: "draw_distance", distance: dist },
    ]);

    const builder = evaluate(ast);
    const prims = collectPrimitives(builder.getRoot());
    assert.ok(prims.length > 0);
    assertNormalsCorrect(prims, size * size * dist, "no mirror face -Y");
  });
});
