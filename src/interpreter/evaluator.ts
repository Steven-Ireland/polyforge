import { vec3, quat } from "gl-matrix";
import type { ASTNode, ModelNode } from "../ast/nodes.js";
import {
  CursorState,
  defaultState,
  cloneState,
  getFacingDirection,
  minRotation,
  generateRing,
} from "./state.js";
import { resolveBuiltinProfile, type Point2D } from "./profiles.js";
import { MeshBuilder } from "../mesh/builder.js";

export function evaluate(model: ModelNode): MeshBuilder {
  const builder = new MeshBuilder(model.name);
  const state = defaultState();
  const saveStack: CursorState[] = [];
  const customProfiles = new Map<string, Point2D[]>();
  // Active axis reflections for mirror blocks (supports nesting via toggle)
  let activeReflect: [boolean, boolean, boolean] = [false, false, false];

  function reflectCoord(v: [number, number, number]): [number, number, number] {
    return [
      activeReflect[0] ? -v[0] : v[0],
      activeReflect[1] ? -v[1] : v[1],
      activeReflect[2] ? -v[2] : v[2],
    ];
  }

  function isWindingFlipped(): boolean {
    const count = activeReflect.filter(Boolean).length;
    return count % 2 !== 0;
  }

  function exec(nodes: ASTNode[]) {
    for (const node of nodes) {
      execNode(node);
    }
  }

  function execNode(node: ASTNode) {
    switch (node.type) {
      case "model":
        exec(node.body);
        break;

      case "group":
        execGroup(node.name, node.body);
        break;

      case "mirror":
        execMirror(node.axes, node.body);
        break;

      case "profile_builtin":
        state.profile = resolveBuiltinProfile(node.shape, node.args);
        break;

      case "profile_custom_def":
        customProfiles.set(node.name, node.points);
        state.profile = node.points;
        break;

      case "profile_custom_ref": {
        const p = customProfiles.get(node.name);
        if (!p) throw new Error(`Unknown custom profile: "${node.name}" at line ${node.loc?.line}`);
        state.profile = p;
        break;
      }

      case "color":
        state.material = {
          r: node.color.r,
          g: node.color.g,
          b: node.color.b,
          metallic: node.metallic ?? 0,
          roughness: node.roughness ?? 0.7,
        };
        break;

      case "move": {
        const rp = reflectCoord(node.position as [number, number, number]);
        vec3.set(state.position, rp[0], rp[1], rp[2]);
        break;
      }

      case "shift": {
        const ro = reflectCoord(node.offset as [number, number, number]);
        state.position[0] += ro[0];
        state.position[1] += ro[1];
        state.position[2] += ro[2];
        break;
      }

      case "face": {
        const rd = reflectCoord(node.direction as [number, number, number]);
        const newDir = vec3.fromValues(rd[0], rd[1], rd[2]);
        vec3.normalize(newDir, newDir);
        const oldDir = getFacingDirection(state.orientation);
        const rot = minRotation(oldDir, newDir);
        quat.multiply(state.orientation, rot, state.orientation);
        quat.normalize(state.orientation, state.orientation);
        break;
      }

      case "rotate":
        state.twist = node.angle;
        break;

      case "taper":
        state.taperStart = node.startScale;
        state.taperEnd = node.endScale;
        state.taperSet = true;
        break;

      case "draw_distance":
        execDrawDistance(node.distance, node.segments);
        break;

      case "draw_target":
        execDrawTarget(node.target, node.segments);
        break;

      case "arc":
        execArc(node.radius, node.angle, node.segments);
        break;

      case "cap":
        if (node.which === "start" || node.which === "both") {
          state.capStart = node.on;
        }
        if (node.which === "end" || node.which === "both") {
          state.capEnd = node.on;
        }
        break;

      case "save":
        saveStack.push(cloneState(state));
        break;

      case "restore": {
        const saved = saveStack.pop();
        if (!saved) throw new Error("restore without matching save");
        Object.assign(state, saved);
        break;
      }
    }
  }

  function execGroup(name: string, body: ASTNode[]) {
    builder.pushGroup(name);
    exec(body);
    builder.popGroup();
  }

  function execMirror(axes: ("x" | "y" | "z")[], body: ASTNode[]) {
    // Generate all 2^N combinations of axis reflections
    const combos = generateMirrorCombos(axes);

    for (const combo of combos) {
      const savedState = cloneState(state);
      const savedReflect: [boolean, boolean, boolean] = [...activeReflect];

      // Toggle active reflections for this combo (toggle supports nesting)
      for (const axis of combo) {
        const idx = axis === "x" ? 0 : axis === "y" ? 1 : 2;
        activeReflect[idx] = !activeReflect[idx];
      }

      // Reflect starting state's position and orientation
      for (const axis of combo) {
        reflectState(state, axis);
      }

      exec(body);

      // Restore state and reflection context
      Object.assign(state, savedState);
      activeReflect = savedReflect;
    }
  }

  function generateMirrorCombos(axes: ("x" | "y" | "z")[]): ("x" | "y" | "z")[][] {
    // Deduplicate axes
    const uniqueAxes = [...new Set(axes)];
    const combos: ("x" | "y" | "z")[][] = [];
    const n = uniqueAxes.length;

    for (let mask = 0; mask < (1 << n); mask++) {
      const combo: ("x" | "y" | "z")[] = [];
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) {
          combo.push(uniqueAxes[i]);
        }
      }
      combos.push(combo);
    }
    return combos;
  }

  function reflectState(s: CursorState, axis: "x" | "y" | "z") {
    // Reflect position
    const idx = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    s.position[idx] = -s.position[idx];

    // Reflect orientation: negate the two quaternion components
    // that correspond to rotations involving the reflected axis
    // For X reflection: negate qy and qz (rotations around Y and Z flip)
    // For Y reflection: negate qx and qz
    // For Z reflection: negate qx and qy
    if (axis === "x") {
      s.orientation[1] = -s.orientation[1]; // qy
      s.orientation[2] = -s.orientation[2]; // qz
    } else if (axis === "y") {
      s.orientation[0] = -s.orientation[0]; // qx
      s.orientation[2] = -s.orientation[2]; // qz
    } else {
      s.orientation[0] = -s.orientation[0]; // qx
      s.orientation[1] = -s.orientation[1]; // qy
    }
  }

  function execDrawDistance(distance: number, segments?: number) {
    if (state.profile.length === 0) {
      throw new Error("No profile set before draw");
    }

    const numSeg = segments ?? 1;
    const dir = getFacingDirection(state.orientation);

    const taperStart = state.taperSet ? state.taperStart : 1;
    const taperEnd = state.taperSet ? state.taperEnd : 1;

    for (let i = 0; i < numSeg; i++) {
      const t0 = i / numSeg;
      const t1 = (i + 1) / numSeg;
      const scale0 = taperStart + (taperEnd - taperStart) * t0;
      const scale1 = taperStart + (taperEnd - taperStart) * t1;

      let ring0 = generateRing(state, scale0);

      // Advance cursor
      const stepDist = distance / numSeg;
      state.position[0] += dir[0] * stepDist;
      state.position[1] += dir[1] * stepDist;
      state.position[2] += dir[2] * stepDist;

      let ring1 = generateRing(state, scale1);

      // Odd-axis reflections reverse triangle winding; fix by reversing ring order
      if (isWindingFlipped()) {
        ring0 = ring0.slice().reverse();
        ring1 = ring1.slice().reverse();
      }

      const isFirst = i === 0;
      const isLast = i === numSeg - 1;

      builder.addExtrudedSegment(
        ring0,
        ring1,
        state.material,
        isFirst && state.capStart,
        isLast && state.capEnd
      );
    }

    // Consume taper
    state.taperSet = false;
    state.taperStart = 1;
    state.taperEnd = 1;
  }

  function execDrawTarget(target: [number, number, number], segments?: number) {
    const rt = reflectCoord(target);
    const targetVec = vec3.fromValues(rt[0], rt[1], rt[2]);
    const diff = vec3.subtract(vec3.create(), targetVec, state.position);
    const distance = vec3.length(diff);

    if (distance < 1e-10) return;

    // Update facing direction to point toward target
    const newDir = vec3.normalize(vec3.create(), diff);
    const oldDir = getFacingDirection(state.orientation);
    const rot = minRotation(oldDir, newDir);
    quat.multiply(state.orientation, rot, state.orientation);
    quat.normalize(state.orientation, state.orientation);

    execDrawDistance(distance, segments);
  }

  function execArc(radius: number, angleDeg: number, segments?: number) {
    if (state.profile.length === 0) {
      throw new Error("No profile set before arc");
    }

    const numSeg = segments ?? Math.max(4, Math.ceil(Math.abs(angleDeg) / 22.5));
    const angleRad = (angleDeg * Math.PI) / 180;
    const stepAngle = angleRad / numSeg;

    // Arc bends in the local "right" direction
    // Center of arc is at cursor position + right * radius
    const facing = getFacingDirection(state.orientation);
    const right = vec3.fromValues(1, 0, 0);
    vec3.transformQuat(right, right, state.orientation);

    const center = vec3.scaleAndAdd(vec3.create(), state.position, right, radius);

    const taperStart = state.taperSet ? state.taperStart : 1;
    const taperEnd = state.taperSet ? state.taperEnd : 1;

    for (let i = 0; i < numSeg; i++) {
      const t0 = i / numSeg;
      const t1 = (i + 1) / numSeg;
      const scale0 = taperStart + (taperEnd - taperStart) * t0;
      const scale1 = taperStart + (taperEnd - taperStart) * t1;

      let ring0 = generateRing(state, scale0);

      // Rotate cursor around arc center
      // The rotation axis is perpendicular to both facing and right (local "up")
      const arcAxis = vec3.cross(vec3.create(), facing, right);
      vec3.normalize(arcAxis, arcAxis);
      const rotQ = quat.setAxisAngle(quat.create(), arcAxis, stepAngle);

      // Move relative to center, rotate, move back
      const relPos = vec3.subtract(vec3.create(), state.position, center);
      vec3.transformQuat(relPos, relPos, rotQ);
      vec3.add(state.position, center, relPos);

      // Also rotate the orientation
      quat.multiply(state.orientation, rotQ, state.orientation);
      quat.normalize(state.orientation, state.orientation);

      let ring1 = generateRing(state, scale1);

      // Odd-axis reflections reverse triangle winding; fix by reversing ring order
      if (isWindingFlipped()) {
        ring0 = ring0.slice().reverse();
        ring1 = ring1.slice().reverse();
      }

      const isFirst = i === 0;
      const isLast = i === numSeg - 1;

      builder.addExtrudedSegment(
        ring0,
        ring1,
        state.material,
        isFirst && state.capStart,
        isLast && state.capEnd
      );
    }

    // Consume taper
    state.taperSet = false;
    state.taperStart = 1;
    state.taperEnd = 1;
  }

  exec(model.body);
  return builder;
}
