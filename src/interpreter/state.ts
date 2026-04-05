import { vec3, quat, mat4 } from "gl-matrix";
import type { Point2D } from "./profiles.js";
import type { MaterialKey } from "../mesh/builder.js";

export interface CursorState {
  position: vec3;
  // Orientation: quaternion mapping default +Y to actual facing direction
  orientation: quat;
  // Profile twist angle in degrees
  twist: number;
  // Current 2D profile points
  profile: Point2D[];
  // Current material
  material: MaterialKey;
  // Taper (one-shot, consumed by next draw)
  taperStart: number;
  taperEnd: number;
  taperSet: boolean;
  // Cap control
  capStart: boolean;
  capEnd: boolean;
}

export function defaultState(): CursorState {
  return {
    position: vec3.fromValues(0, 0, 0),
    orientation: quat.create(), // identity = facing +Y
    twist: 0,
    profile: [], // must be set before drawing
    material: { r: 0.5, g: 0.5, b: 0.5, metallic: 0, roughness: 0.7 },
    taperStart: 1,
    taperEnd: 1,
    taperSet: false,
    capStart: true,
    capEnd: true,
  };
}

export function cloneState(s: CursorState): CursorState {
  return {
    position: vec3.clone(s.position),
    orientation: quat.clone(s.orientation),
    twist: s.twist,
    profile: s.profile.map(([x, y]) => [x, y] as Point2D),
    material: { ...s.material },
    taperStart: s.taperStart,
    taperEnd: s.taperEnd,
    taperSet: s.taperSet,
    capStart: s.capStart,
    capEnd: s.capEnd,
  };
}

// Get the facing direction from orientation (transform default +Y)
export function getFacingDirection(orientation: quat): vec3 {
  const dir = vec3.fromValues(0, 1, 0);
  vec3.transformQuat(dir, dir, orientation);
  return dir;
}

// Get the "right" vector (transform default +X)
export function getRightVector(orientation: quat): vec3 {
  const right = vec3.fromValues(1, 0, 0);
  vec3.transformQuat(right, right, orientation);
  return right;
}

// Get the "forward" vector in the profile plane (transform default +Z)
export function getForwardVector(orientation: quat): vec3 {
  const fwd = vec3.fromValues(0, 0, 1);
  vec3.transformQuat(fwd, fwd, orientation);
  return fwd;
}

// Compute minimum rotation quaternion from one direction to another
export function minRotation(from: vec3, to: vec3): quat {
  const fromN = vec3.normalize(vec3.create(), from);
  const toN = vec3.normalize(vec3.create(), to);

  const dot = vec3.dot(fromN, toN);

  if (dot > 0.999999) {
    return quat.create(); // identity
  }

  if (dot < -0.999999) {
    // 180 degree rotation: find perpendicular axis
    let perp = vec3.cross(vec3.create(), fromN, vec3.fromValues(1, 0, 0));
    if (vec3.length(perp) < 0.001) {
      perp = vec3.cross(vec3.create(), fromN, vec3.fromValues(0, 1, 0));
    }
    vec3.normalize(perp, perp);
    return quat.setAxisAngle(quat.create(), perp, Math.PI);
  }

  const axis = vec3.cross(vec3.create(), fromN, toN);
  const q = quat.fromValues(axis[0], axis[1], axis[2], 1 + dot);
  return quat.normalize(q, q);
}

// Transform a 2D profile point into 3D world space given cursor state
export function profilePointToWorld(
  point: Point2D,
  state: CursorState,
  scale: number = 1
): [number, number, number] {
  // Profile point is in the XZ plane (perpendicular to +Y default facing)
  // Apply twist rotation, then scale, then orient, then translate
  const twistRad = (state.twist * Math.PI) / 180;
  const cos = Math.cos(twistRad);
  const sin = Math.sin(twistRad);
  const tx = (point[0] * cos - point[1] * sin) * scale;
  const tz = (point[0] * sin + point[1] * cos) * scale;

  // Local point in default orientation (profile in XZ plane, facing +Y)
  const local = vec3.fromValues(tx, 0, tz);

  // Rotate by cursor orientation
  vec3.transformQuat(local, local, state.orientation);

  // Translate to cursor position
  return [
    local[0] + state.position[0],
    local[1] + state.position[1],
    local[2] + state.position[2],
  ];
}

// Generate a world-space ring from the current profile at the cursor position
export function generateRing(
  state: CursorState,
  scale: number = 1
): [number, number, number][] {
  return state.profile.map((p) => profilePointToWorld(p, state, scale));
}
