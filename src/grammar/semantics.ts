import * as ohm from "ohm-js";
import type {
  ASTNode,
  ModelNode,
  ColorNode,
} from "../ast/nodes.js";

const grammarSource = `PolyForge {
  Model = "model" string "{" Statement* "}"

  Statement = Group
            | Mirror
            | ProfileCustomDef
            | ProfileBuiltin
            | ProfileCustomRef
            | Color
            | Move
            | Shift
            | Face
            | Rotate
            | Taper
            | DrawTarget
            | DrawDistance
            | Arc
            | Cap
            | Save
            | Restore

  Group = "group" string "{" Statement* "}"

  Mirror = "mirror" Axis+ "{" Statement* "}"

  // Profiles
  ProfileBuiltin = "profile" BuiltinShape "(" NumList ")"
  ProfileCustomDef = "profile" "custom" string "[" Point2dList "]"
  ProfileCustomRef = "profile" string

  BuiltinShape = "circle" | "square" | "rect" | "hex" | "ngon" | "diamond"

  // Color
  Color = "color" ColorValue MaterialProps?
  ColorValue = HexColor | RgbColor | string
  HexColor = "#" hexDigit hexDigit hexDigit hexDigit hexDigit hexDigit
  RgbColor = "rgb" "(" NumList ")"
  MaterialProps = MaterialProp+
  MaterialProp = "metallic" number
               | "roughness" number

  // Cursor
  Move = "move" Point3d
  Shift = "shift" Point3d
  Face = "face" Point3d
  Rotate = "rotate" number

  // Drawing
  Taper = "taper" number number?
  DrawDistance = "draw" number Segments?
  DrawTarget = "draw" Point3d Segments?
  Arc = "arc" number number Segments?
  Segments = "segments" number

  // Caps
  Cap = "cap" CapWhich CapOnOff
  CapWhich = "start" | "end" | "both"
  CapOnOff = "on" | "off"

  // Save/Restore
  Save = "save"
  Restore = "restore"

  // Primitives (syntactic rules — auto-skip spaces)
  Point3d = "(" number "," number "," number ")"
  Point2d = "(" number "," number ")"
  Point2dList = Point2d ("," Point2d)*
  NumList = number ("," number)*

  // Lexical rules (no auto space-skip)
  Axis = "x" | "y" | "z"

  number = "-"? digit+ ("." digit+)?

  string = "\\"" (~"\\"" any)* "\\""

  // Whitespace and comments
  space += comment
  comment = "//" (~"\\n" any)* ("\\n" | end)
          | "/*" (~"*/" any)* "*/"
}`;

const grammar = ohm.grammar(grammarSource);

const semantics = grammar.createSemantics();

// Named color palette
const NAMED_COLORS: Record<string, { r: number; g: number; b: number }> = {
  steel: { r: 0.66, g: 0.66, b: 0.68 },
  iron: { r: 0.28, g: 0.29, b: 0.29 },
  gold: { r: 1.0, g: 0.84, b: 0.0 },
  wood: { r: 0.55, g: 0.41, b: 0.08 },
  "wood-dark": { r: 0.36, g: 0.25, b: 0.2 },
  leather: { r: 0.55, g: 0.27, b: 0.07 },
  stone: { r: 0.5, g: 0.5, b: 0.5 },
  red: { r: 0.8, g: 0.2, b: 0.2 },
  green: { r: 0.2, g: 0.6, b: 0.2 },
  blue: { r: 0.2, g: 0.4, b: 0.8 },
  white: { r: 0.96, g: 0.96, b: 0.96 },
  black: { r: 0.1, g: 0.1, b: 0.1 },
  skin: { r: 1.0, g: 0.8, b: 0.6 },
  bone: { r: 0.89, g: 0.85, b: 0.79 },
  ruby: { r: 0.61, g: 0.07, b: 0.12 },
  emerald: { r: 0.31, g: 0.78, b: 0.47 },
  "cloth-red": { r: 0.55, g: 0.0, b: 0.0 },
  "cloth-blue": { r: 0.1, g: 0.1, b: 0.44 },
};

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

function getLoc(node: ohm.Node) {
  const interval = node.source;
  const lineAndCol = interval.getLineAndColumn() as unknown as string;
  // ohm's getLineAndColumn returns a string like "Line 3, col 5"
  // We'll parse the source interval offset instead
  const startIdx = interval.startIdx;
  const fullInput = interval.sourceString;
  let line = 1;
  let col = 1;
  for (let i = 0; i < startIdx; i++) {
    if (fullInput[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

semantics.addOperation<any>("toAST", {
  Model(_model, nameNode, _open, stmts, _close) {
    return {
      type: "model",
      name: nameNode.toAST(),
      body: stmts.children.map((c: ohm.Node) => c.toAST()),
      loc: getLoc(this),
    } as ModelNode;
  },

  Group(_group, nameNode, _open, stmts, _close) {
    return {
      type: "group",
      name: nameNode.toAST(),
      body: stmts.children.map((c: ohm.Node) => c.toAST()),
      loc: getLoc(this),
    };
  },

  Mirror(_mirror, axes, _open, stmts, _close) {
    return {
      type: "mirror",
      axes: axes.children.map((c: ohm.Node) => c.sourceString),
      body: stmts.children.map((c: ohm.Node) => c.toAST()),
      loc: getLoc(this),
    };
  },

  ProfileBuiltin(_profile, shape, _open, args, _close) {
    return {
      type: "profile_builtin",
      shape: shape.sourceString,
      args: args.toAST(),
      loc: getLoc(this),
    };
  },

  ProfileCustomDef(_profile, _custom, nameNode, _open, points, _close) {
    return {
      type: "profile_custom_def",
      name: nameNode.toAST(),
      points: points.toAST(),
      loc: getLoc(this),
    };
  },

  ProfileCustomRef(_profile, nameNode) {
    return {
      type: "profile_custom_ref",
      name: nameNode.toAST(),
      loc: getLoc(this),
    };
  },

  Color(_color, colorVal, matProps) {
    const base = colorVal.toAST() as ColorNode["color"];
    const props = matProps.children.length > 0 ? matProps.children[0].toAST() : {};
    return {
      type: "color",
      color: base,
      ...props,
      loc: getLoc(this),
    };
  },

  ColorValue(inner) {
    return inner.toAST();
  },

  HexColor(_hash, h1, h2, h3, h4, h5, h6) {
    const hex = "#" + h1.sourceString + h2.sourceString + h3.sourceString +
      h4.sourceString + h5.sourceString + h6.sourceString;
    return parseHexColor(hex);
  },

  RgbColor(_rgb, _open, nums, _close) {
    const values = nums.toAST() as number[];
    return {
      r: values[0] / 255,
      g: values[1] / 255,
      b: values[2] / 255,
    };
  },

  MaterialProps(props) {
    const result: Record<string, number> = {};
    for (const p of props.children) {
      const [key, val] = p.toAST();
      result[key] = val;
    }
    return result;
  },

  MaterialProp(key, val) {
    return [key.sourceString, Number(val.sourceString)];
  },

  Move(_move, point) {
    const [x, y, z] = point.toAST();
    return { type: "move", position: [x, y, z], loc: getLoc(this) };
  },

  Shift(_shift, point) {
    const [x, y, z] = point.toAST();
    return { type: "shift", offset: [x, y, z], loc: getLoc(this) };
  },

  Face(_face, point) {
    const [x, y, z] = point.toAST();
    return { type: "face", direction: [x, y, z], loc: getLoc(this) };
  },

  Rotate(_rotate, angle) {
    return { type: "rotate", angle: Number(angle.sourceString), loc: getLoc(this) };
  },

  Taper(_taper, first, second) {
    const v1 = Number(first.sourceString);
    if (second.children.length > 0) {
      const v2 = Number(second.children[0].sourceString);
      return { type: "taper", startScale: v1, endScale: v2, loc: getLoc(this) };
    }
    return { type: "taper", startScale: 1, endScale: v1, loc: getLoc(this) };
  },

  DrawDistance(_draw, dist, segs) {
    return {
      type: "draw_distance",
      distance: Number(dist.sourceString),
      segments: segs.children.length > 0 ? segs.children[0].toAST() : undefined,
      loc: getLoc(this),
    };
  },

  DrawTarget(_draw, point, segs) {
    const [x, y, z] = point.toAST();
    return {
      type: "draw_target",
      target: [x, y, z] as [number, number, number],
      segments: segs.children.length > 0 ? segs.children[0].toAST() : undefined,
      loc: getLoc(this),
    };
  },

  Arc(_arc, radius, angle, segs) {
    return {
      type: "arc",
      radius: Number(radius.sourceString),
      angle: Number(angle.sourceString),
      segments: segs.children.length > 0 ? segs.children[0].toAST() : undefined,
      loc: getLoc(this),
    };
  },

  Segments(_seg, n) {
    return Number(n.sourceString);
  },

  Cap(_cap, which, onOff) {
    return {
      type: "cap",
      which: which.sourceString.trim(),
      on: onOff.sourceString.trim() === "on",
      loc: getLoc(this),
    };
  },

  Save(_save) {
    return { type: "save", loc: getLoc(this) };
  },

  Restore(_restore) {
    return { type: "restore", loc: getLoc(this) };
  },

  Point3d(_open, x, _c1, y, _c2, z, _close) {
    return [Number(x.sourceString), Number(y.sourceString), Number(z.sourceString)];
  },

  Point2d(_open, x, _c1, y, _close) {
    return [Number(x.sourceString), Number(y.sourceString)];
  },

  Point2dList(first, _commas, rest) {
    return [first.toAST(), ...rest.children.map((c: ohm.Node) => c.toAST())];
  },

  NumList(first, _commas, rest) {
    return [Number(first.sourceString), ...rest.children.map((c: ohm.Node) => Number(c.sourceString))];
  },

  string(_open, chars, _close) {
    const name = chars.sourceString;
    // If this is used as a color value, resolve named colors
    if (NAMED_COLORS[name]) {
      return NAMED_COLORS[name];
    }
    return name;
  },

  _iter(...children) {
    return children.map((c) => c.toAST());
  },

  _terminal() {
    return this.sourceString;
  },
});

export function parse(source: string): ModelNode {
  const matchResult = grammar.match(source);
  if (matchResult.failed()) {
    throw new Error(`Parse error: ${matchResult.message}`);
  }
  return semantics(matchResult).toAST();
}

export { grammar, NAMED_COLORS };
