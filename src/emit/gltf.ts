import {
  Document,
  NodeIO,
  Buffer as GLTFBuffer,
} from "@gltf-transform/core";
import type { MeshGroup, MaterialKey } from "../mesh/builder.js";

function materialKeyStr(m: MaterialKey): string {
  return `${m.r.toFixed(4)},${m.g.toFixed(4)},${m.b.toFixed(4)},${m.metallic.toFixed(2)},${m.roughness.toFixed(2)}`;
}

export async function emitGLB(root: MeshGroup, outputPath: string): Promise<void> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const materialCache = new Map<string, ReturnType<Document["createMaterial"]>>();

  function getOrCreateMaterial(key: MaterialKey) {
    const keyStr = materialKeyStr(key);
    let mat = materialCache.get(keyStr);
    if (!mat) {
      mat = doc
        .createMaterial()
        .setBaseColorFactor([key.r, key.g, key.b, 1])
        .setMetallicFactor(key.metallic)
        .setRoughnessFactor(key.roughness);
      materialCache.set(keyStr, mat);
    }
    return mat;
  }

  function buildNode(group: MeshGroup) {
    const node = doc.createNode(group.name);

    if (group.primitives.length > 0) {
      const mesh = doc.createMesh(group.name);

      for (const prim of group.primitives) {
        if (prim.positions.length === 0) continue;

        const posAccessor = doc
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(prim.positions))
          .setBuffer(buffer);

        const normAccessor = doc
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(prim.normals))
          .setBuffer(buffer);

        const idxAccessor = doc
          .createAccessor()
          .setType("SCALAR")
          .setArray(new Uint16Array(prim.indices))
          .setBuffer(buffer);

        const primitive = doc
          .createPrimitive()
          .setAttribute("POSITION", posAccessor)
          .setAttribute("NORMAL", normAccessor)
          .setIndices(idxAccessor)
          .setMaterial(getOrCreateMaterial(prim.material));

        mesh.addPrimitive(primitive);
      }

      node.setMesh(mesh);
    }

    for (const child of group.children) {
      node.addChild(buildNode(child));
    }

    return node;
  }

  const rootNode = buildNode(root);
  scene.addChild(rootNode);

  const io = new NodeIO();
  await io.write(outputPath, doc);
}
