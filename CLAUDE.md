# PolyForge

A DSL for creating low-poly 3D models. One `.pf` file per model, outputs `.glb` (binary glTF).

## DSL Concept

Pen/brush metaphor: set a cross-section profile, position a cursor in 3D space, and draw strokes that extrude geometry. Supports symmetry (`mirror`), taper, color/PBR materials, grouping, and save/restore for branching. See [DSL.md](DSL.md) for full syntax reference and rationale.

## Project Structure

```
src/
  grammar/semantics.ts    # Ohm PEG grammar (inlined) + AST construction
  ast/nodes.ts            # AST type definitions
  interpreter/
    state.ts              # Cursor state, orientation math, profile-to-world transform
    evaluator.ts          # AST walker — executes draw/mirror/group/taper/arc
    profiles.ts           # Built-in 2D profile generators (circle, rect, diamond, etc.)
  mesh/builder.ts         # Accumulates vertices/indices with flat-shaded normals
  emit/gltf.ts            # Converts mesh data to glTF using @gltf-transform/core
  cli/index.ts            # CLI entry point
examples/                 # Sample .pf files (sword, chair)
```

## Commands

```
npm run build                          # Compile TypeScript
node dist/cli/index.js build file.pf   # Compile .pf to .glb
node dist/cli/index.js validate file.pf
```

## Key Dependencies

ohm-js (parser), @gltf-transform/core (glTF output), gl-matrix (3D math), commander (CLI).
