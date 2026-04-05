// MeshBuilder accumulates geometry from draw operations
// Each group gets its own mesh data, split by material

export interface MaterialKey {
  r: number;
  g: number;
  b: number;
  metallic: number;
  roughness: number;
}

export interface MeshPrimitive {
  positions: number[];  // flat xyz
  normals: number[];    // flat xyz
  indices: number[];
  material: MaterialKey;
}

export interface MeshGroup {
  name: string;
  primitives: MeshPrimitive[];
  children: MeshGroup[];
}

function materialKeyStr(m: MaterialKey): string {
  return `${m.r.toFixed(4)},${m.g.toFixed(4)},${m.b.toFixed(4)},${m.metallic.toFixed(2)},${m.roughness.toFixed(2)}`;
}

export class MeshBuilder {
  private groupStack: MeshGroup[] = [];
  private currentGroup: MeshGroup;

  constructor(rootName: string) {
    this.currentGroup = { name: rootName, primitives: [], children: [] };
  }

  pushGroup(name: string) {
    const child: MeshGroup = { name, primitives: [], children: [] };
    this.groupStack.push(this.currentGroup);
    this.currentGroup.children.push(child);
    this.currentGroup = child;
  }

  popGroup() {
    const parent = this.groupStack.pop();
    if (!parent) throw new Error("Cannot pop root group");
    this.currentGroup = parent;
  }

  // Add an extruded segment: side faces connecting two vertex rings
  // ring0 and ring1 are arrays of [x,y,z] in world space
  addExtrudedSegment(
    ring0: [number, number, number][],
    ring1: [number, number, number][],
    material: MaterialKey,
    capStart: boolean,
    capEnd: boolean
  ) {
    const prim = this.getOrCreatePrimitive(material);
    const n = ring0.length;

    // Side faces: quads split into two triangles each
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      const a = ring0[i];
      const b = ring0[i2];
      const c = ring1[i2];
      const d = ring1[i];

      // Two triangles: a-c-b and a-d-c (CCW winding for outward normals)
      this.addFlatTriangle(prim, a, c, b);
      this.addFlatTriangle(prim, a, d, c);
    }

    // Cap faces
    if (capStart) {
      this.addCapFace(prim, ring0, true);
    }
    if (capEnd) {
      this.addCapFace(prim, ring1, false);
    }
  }

  private addFlatTriangle(
    prim: MeshPrimitive,
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number]
  ) {
    // Compute face normal
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1e-10) {
      nx /= len; ny /= len; nz /= len;
    }

    const baseIdx = prim.positions.length / 3;
    // Duplicate vertices for flat shading
    for (const p of [a, b, c]) {
      prim.positions.push(p[0], p[1], p[2]);
      prim.normals.push(nx, ny, nz);
    }
    prim.indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
  }

  private addCapFace(
    prim: MeshPrimitive,
    ring: [number, number, number][],
    flipNormal: boolean
  ) {
    // Fan triangulation from center
    // For start cap, we flip winding to face outward
    const n = ring.length;
    if (n < 3) return;

    for (let i = 1; i < n - 1; i++) {
      if (flipNormal) {
        this.addFlatTriangle(prim, ring[0], ring[i], ring[i + 1]);
      } else {
        this.addFlatTriangle(prim, ring[0], ring[i + 1], ring[i]);
      }
    }
  }

  private getOrCreatePrimitive(material: MaterialKey): MeshPrimitive {
    const key = materialKeyStr(material);
    let prim = this.currentGroup.primitives.find(
      (p) => materialKeyStr(p.material) === key
    );
    if (!prim) {
      prim = { positions: [], normals: [], indices: [], material };
      this.currentGroup.primitives.push(prim);
    }
    return prim;
  }

  getRoot(): MeshGroup {
    return this.groupStack.length > 0 ? this.groupStack[0] : this.currentGroup;
  }
}
