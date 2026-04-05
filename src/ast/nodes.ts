// AST node types for the PolyForge DSL

export interface SourceLocation {
  line: number;
  col: number;
}

export type ASTNode =
  | ModelNode
  | GroupNode
  | MirrorNode
  | ProfileBuiltinNode
  | ProfileCustomDefNode
  | ProfileCustomRefNode
  | ColorNode
  | MoveNode
  | ShiftNode
  | FaceNode
  | RotateNode
  | TaperNode
  | DrawDistanceNode
  | DrawTargetNode
  | ArcNode
  | CapNode
  | SaveNode
  | RestoreNode;

export interface ModelNode {
  type: "model";
  name: string;
  body: ASTNode[];
  loc?: SourceLocation;
}

export interface GroupNode {
  type: "group";
  name: string;
  body: ASTNode[];
  loc?: SourceLocation;
}

export interface MirrorNode {
  type: "mirror";
  axes: ("x" | "y" | "z")[];
  body: ASTNode[];
  loc?: SourceLocation;
}

export interface ProfileBuiltinNode {
  type: "profile_builtin";
  shape: "circle" | "square" | "rect" | "hex" | "ngon" | "diamond";
  args: number[];
  loc?: SourceLocation;
}

export interface ProfileCustomDefNode {
  type: "profile_custom_def";
  name: string;
  points: [number, number][];
  loc?: SourceLocation;
}

export interface ProfileCustomRefNode {
  type: "profile_custom_ref";
  name: string;
  loc?: SourceLocation;
}

export interface ColorNode {
  type: "color";
  color: { r: number; g: number; b: number };
  metallic?: number;
  roughness?: number;
  loc?: SourceLocation;
}

export interface MoveNode {
  type: "move";
  position: [number, number, number];
  loc?: SourceLocation;
}

export interface ShiftNode {
  type: "shift";
  offset: [number, number, number];
  loc?: SourceLocation;
}

export interface FaceNode {
  type: "face";
  direction: [number, number, number];
  loc?: SourceLocation;
}

export interface RotateNode {
  type: "rotate";
  angle: number;
  loc?: SourceLocation;
}

export interface TaperNode {
  type: "taper";
  startScale: number;
  endScale: number;
  loc?: SourceLocation;
}

export interface DrawDistanceNode {
  type: "draw_distance";
  distance: number;
  segments?: number;
  loc?: SourceLocation;
}

export interface DrawTargetNode {
  type: "draw_target";
  target: [number, number, number];
  segments?: number;
  loc?: SourceLocation;
}

export interface ArcNode {
  type: "arc";
  radius: number;
  angle: number;
  segments?: number;
  loc?: SourceLocation;
}

export interface CapNode {
  type: "cap";
  which: "start" | "end" | "both";
  on: boolean;
  loc?: SourceLocation;
}

export interface SaveNode {
  type: "save";
  loc?: SourceLocation;
}

export interface RestoreNode {
  type: "restore";
  loc?: SourceLocation;
}
