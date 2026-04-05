// Generate 2D vertex rings (cross-section profiles) for extrusion
// Points are in the XZ plane (profile plane perpendicular to Y-up default facing)
// Returned as [x, z] pairs, wound counter-clockwise when viewed from +Y

export type Point2D = [number, number];

export function circleProfile(radius: number, sides: number = 6): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides;
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return points;
}

export function squareProfile(size: number): Point2D[] {
  const h = size / 2;
  return [[-h, -h], [h, -h], [h, h], [-h, h]];
}

export function rectProfile(width: number, height: number): Point2D[] {
  const hw = width / 2;
  const hh = height / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
}

export function hexProfile(radius: number): Point2D[] {
  return circleProfile(radius, 6);
}

export function ngonProfile(radius: number, sides: number): Point2D[] {
  return circleProfile(radius, Math.max(3, Math.round(sides)));
}

export function diamondProfile(width: number, height: number): Point2D[] {
  const hw = width / 2;
  const hh = height / 2;
  return [[0, -hh], [hw, 0], [0, hh], [-hw, 0]];
}

export function resolveBuiltinProfile(
  shape: string,
  args: number[]
): Point2D[] {
  switch (shape) {
    case "circle":
      return circleProfile(args[0], args[1] ?? 6);
    case "square":
      return squareProfile(args[0]);
    case "rect":
      return rectProfile(args[0], args[1]);
    case "hex":
      return hexProfile(args[0]);
    case "ngon":
      return ngonProfile(args[0], args[1]);
    case "diamond":
      return diamondProfile(args[0], args[1]);
    default:
      throw new Error(`Unknown profile shape: ${shape}`);
  }
}

export function scaleProfile(
  profile: Point2D[],
  sx: number,
  sy: number
): Point2D[] {
  return profile.map(([x, y]) => [x * sx, y * sy]);
}

export function rotateProfile(profile: Point2D[], degrees: number): Point2D[] {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return profile.map(([x, y]) => [
    x * cos - y * sin,
    x * sin + y * cos,
  ]);
}
