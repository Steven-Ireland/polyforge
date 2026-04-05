# PolyForge DSL Reference

## Overview

PolyForge is a text-based language for describing low-poly 3D models. Each `.pf` file defines one model and compiles to a `.glb` (binary glTF) file.

The central metaphor is a **pen on a 3D workbench**. You:

1. Pick a cross-section shape (the "brush nib")
2. Position a cursor in 3D space
3. Draw strokes that extrude the shape along a path

The language reads top-to-bottom like a recipe. There are no variables, loops, or conditionals — just an ordered list of drawing instructions. Repetition is handled by `mirror` (symmetry) rather than programming constructs.

## Coordinate System

Right-handed, Y-up (matching glTF convention). The cursor starts at the origin `(0, 0, 0)` facing `+Y` (upward). Units are abstract — think of them as centimeters or whatever suits you.

## File Structure

Every file has exactly one `model` block:

```
model "My Model" {
  // commands go here
}
```

The string is the model's display name, embedded in glTF metadata.

## Comments

```
// single line comment
/* multi-line
   comment */
```

## Commands

### profile — Set the Brush Shape

A profile is the 2D cross-section that gets swept along a draw path. It lives on the plane perpendicular to the cursor's facing direction.

**Built-in shapes:**

| Shape | Syntax | Description |
|-------|--------|-------------|
| Circle | `profile circle(radius)` | Regular polygon, 6 sides by default |
| Square | `profile square(size)` | Axis-aligned square |
| Rectangle | `profile rect(width, height)` | Axis-aligned rectangle |
| Hexagon | `profile hex(radius)` | Regular hexagon (same as circle with 6 sides) |
| N-gon | `profile ngon(radius, sides)` | Regular polygon with N sides |
| Diamond | `profile diamond(width, height)` | Four-point diamond (rhombus) |

Side counts are intentionally low — this is a low-poly tool. `circle(0.5)` gives you a hexagon. Use `ngon(0.5, 12)` if you want more sides.

**Custom profiles:**

Define a cross-section from a list of 2D points. Points are connected in order and automatically closed.

```
profile custom "blade" [(0, 0), (0.5, 0.1), (0.5, -0.1), (-0.5, -0.1), (-0.5, 0.1)]
```

Once defined, reuse by name:

```
profile "blade"
```

### color — Set the Active Material

Color applies to all subsequent `draw` commands until changed.

```
color #8B4513              // hex RGB
color rgb(139, 69, 19)     // explicit RGB (0-255)
color "steel"              // named palette color
```

**Optional PBR properties** (map to glTF metallic-roughness):

```
color "gold" metallic 0.9 roughness 0.2
color #CC3333 roughness 0.5
```

Defaults: `metallic 0`, `roughness 0.7` (matte, good for low-poly).

**Built-in palette:**

| Name | Hex | Typical use |
|------|-----|-------------|
| `"steel"` | #A8A8AD | Metal blades, armor |
| `"iron"` | #484A4B | Dark metal |
| `"gold"` | #FFD700 | Accents, jewelry |
| `"wood"` | #8C6914 | Furniture, handles |
| `"wood-dark"` | #5C4033 | Stained wood |
| `"leather"` | #8C4513 | Grips, straps |
| `"stone"` | #808080 | Walls, floors |
| `"red"` | #CC3333 | General purpose |
| `"green"` | #339933 | General purpose |
| `"blue"` | #3366CC | General purpose |
| `"white"` | #F5F5F5 | General purpose |
| `"black"` | #1A1A1A | General purpose |
| `"skin"` | #FFCC99 | Characters |
| `"bone"` | #E3DAC9 | Skeletal, ivory |
| `"ruby"` | #9B111E | Gems |
| `"emerald"` | #50C878 | Gems |
| `"cloth-red"` | #8B0000 | Fabric |
| `"cloth-blue"` | #191970 | Fabric |

### move / shift — Position the Cursor

```
move (x, y, z)       // set absolute position
shift (dx, dy, dz)   // offset relative to current position
```

Moving does not create any geometry — it just repositions the pen.

### face — Set the Draw Direction

```
face (0, 1, 0)    // face upward (+Y, the default)
face (1, 0, 0)    // face right (+X)
face (0, -1, 0)   // face downward (-Y)
face (1, 1, 0)    // face diagonally (auto-normalized)
```

The direction vector is normalized automatically. The profile plane is always perpendicular to the facing direction.

When you change direction, the profile rotates using a **minimum rotation** — the shortest rotation that maps the old direction to the new one. This avoids unexpected flips.

### rotate — Twist the Profile

```
rotate 45    // twist the cross-section 45 degrees around the draw axis
```

This spins the profile in place without changing the draw direction. Useful for rotating a diamond or rectangle to a different angle.

### draw — Extrude Geometry

The core command. Extrudes the current profile along a path from the cursor's current position. After drawing, the cursor moves to the end of the stroke.

**By distance** (in the current facing direction):

```
draw 3                  // extrude 3 units forward
draw 0.5 segments 4     // extrude with 4 subdivisions
```

**To a point** (extrudes toward an absolute position, updating facing direction):

```
draw (2, 5, 0)           // extrude toward this point
draw (0, 10, 0) segments 8
```

The `segments` option subdivides the stroke for smoother taper transitions. Default is 1 segment for straight draws.

### taper — Scale Along a Draw

Taper changes the profile's size over the course of the next `draw` command.

```
taper 0             // shrink to nothing (for tips and spikes)
taper 0.5           // shrink to half size
taper 1 1.5         // grow from full size to 1.5x
taper 0.5 1         // grow from half to full
```

With one number: scales from 1.0 (current size) to the given value.
With two numbers: scales from the first value to the second.

**Taper is one-shot** — it is consumed by the next `draw` and then resets to 1.0. This is deliberate: a forgotten taper that cascades through subsequent draws would produce mangled geometry that's hard to debug. Color, by contrast, is persistent because wrong color is visually obvious and non-destructive.

**Chaining tapers:** Because taper resets after each draw, consecutive tapered draws must chain manually. If a draw ends at scale 0.7, the next taper should start at 0.7 to avoid a visible seam: `taper 0.7 0.4`.

### arc — Curved Extrusion

```
arc 2 90               // radius 2, 90-degree arc
arc 1 180 segments 8   // half-circle with 8 subdivisions
```

The arc curves toward the local "right" direction (perpendicular to facing, in the profile plane). Segment count defaults to roughly one segment per 22.5 degrees.

### cap — Control Open/Closed Ends

By default, both ends of a draw stroke are capped (closed with a face). Override when you want hollow shapes or seamless joins.

```
cap start off     // leave the start end open
cap end off       // leave the end open
cap both on       // close both ends (the default)
```

### mirror — Symmetry

Duplicates geometry across one or more planes. The mirror plane always passes through the origin.

```
mirror x {
  // everything here is drawn twice: once normally, once flipped across X=0
  move (1, 0, 0)
  draw 3
}
```

**Multi-axis mirror** produces 2^N copies:

```
mirror x z {
  // draws in all four quadrants (original + X-flip + Z-flip + XZ-flip)
  move (1, 0, 1)
  profile square(0.15)
  draw 2
}
```

Mirror is **block-scoped** rather than a toggle. This prevents the common bug of forgetting to turn off mirroring and accidentally duplicating unrelated geometry.

### group — Organize Parts

Groups create named sections in the output glTF node hierarchy. They help with readability and make the model browsable in 3D tools.

```
group "blade" {
  // commands...
}
```

Groups can nest:

```
group "hilt" {
  group "crossguard" { ... }
  group "grip" { ... }
  group "pommel" { ... }
}
```

### connect — Assert Groups Touch

Declares that two sibling groups should share geometry at their boundary. If they don't, the CLI emits a warning with the nearest distance between them. This is useful for catching alignment bugs without flagging intentionally separate parts.

```
connect "blade" "hilt"
```

Place `connect` inside the scope where both groups are defined:

```
model "Iron Sword" {
  connect "blade" "hilt"
  group "blade" { ... }
  group "hilt" {
    connect "crossguard" "grip"
    group "crossguard" { ... }
    group "grip" { ... }
  }
}
```

The check runs during both `build` and `validate`. Warnings are non-blocking — the build still succeeds.

### save / restore — Branch and Return

When you need to draw a branch and then return to continue from the same point (like adding crossguards to a sword blade), use save/restore:

```
draw 5       // draw the main shaft

save         // remember cursor position, orientation, profile, color, taper
  face (1, 0, 0)
  draw 1.5   // branch off to the right
restore      // pop back to where we were

save
  face (-1, 0, 0)
  draw 1.5   // branch off to the left
restore

draw 3       // continue upward from the saved position
```

Save/restore work as a stack (push/pop). They preserve: position, orientation, twist, profile, color, taper, and cap state.

## Design Rationale

### Why no variables or loops?

The target audience includes non-programmers. Variables and loops shift the mental model from "list of drawing instructions" to "program." For low-poly models, repetition is minimal and handled by `mirror`. If a model needs 20 identical teeth on a gear, a `repeat` construct may be added in a future version.

### Why is the syntax so uniform?

Every command that takes coordinates uses the same `(x, y, z)` tuple syntax. There are no special shorthands like `move to center` or `face +Y`. This makes the grammar regular and easy to parse, and means you never have to remember which commands accept which shorthand forms.

### Why flat shading?

All geometry uses flat shading (unique normals per face, no smoothing). This is the defining low-poly aesthetic — faceted surfaces with visible edges. The compiler handles this by duplicating vertices so each triangle has its own face normal.

### Why one-shot taper?

A persistent taper would cascade through subsequent draws if you forget to reset it, producing geometry errors that are hard to spot. Color persists because wrong color is immediately visible and non-destructive. Wrong taper produces structural damage to the mesh.

### Why block-scoped mirror?

A toggle-style mirror (`mirror on` / `mirror off`) invites the classic bug of forgetting to turn it off. The block syntax `mirror x { ... }` makes the mirrored region visually explicit and self-closing.

## Full Example: Sword

```
model "Iron Sword" {

  group "blade" {
    move (0, 0, 0)
    face (0, 1, 0)
    color "steel" metallic 0.7 roughness 0.3
    profile diamond(0.4, 0.15)

    // Main blade shaft
    draw 4

    // Tip tapers to a point
    taper 0
    draw 1.5 segments 4
  }

  group "hilt" {
    group "crossguard" {
      color "gold" metallic 0.9 roughness 0.2
      profile rect(0.15, 0.1)

      mirror x {
        move (0, -0.1, 0)
        face (1, 0, 0)
        draw 1.2

        // Slight flare at the tips
        taper 1 1.3
        draw 0.3
      }
    }

    group "grip" {
      move (0, -0.1, 0)
      face (0, -1, 0)
      color "leather" roughness 0.9
      profile circle(0.18)

      // Grip is slightly wider in the middle
      taper 1 1.15
      draw 0.9

      taper 1.15 1
      draw 0.9
    }

    group "pommel" {
      // cursor continues from end of grip
      color "gold" metallic 0.9 roughness 0.2
      profile circle(0.25)

      draw 0.2

      taper 0.6
      draw 0.2
    }
  }
}
```

## Full Example: Chair

```
model "Wooden Chair" {

  group "legs" {
    color "wood"
    profile square(0.15)
    face (0, -1, 0)

    // Four legs via double mirror
    mirror x z {
      move (0.7, 0, 0.7)
      draw 2
    }
  }

  group "seat" {
    move (0, 0, 0)
    face (0, 1, 0)
    color "wood-dark"
    profile rect(1.6, 1.6)
    draw 0.12
  }

  group "backrest" {
    color "wood"

    // Two vertical posts
    mirror x {
      move (0.65, 0.12, -0.7)
      face (0, 1, 0)
      profile square(0.12)
      draw 2
    }

    // Top slat connecting the posts
    group "top-slat" {
      move (-0.65, 2.12, -0.7)
      face (1, 0, 0)
      profile rect(0.08, 0.4)
      draw 1.3
    }

    // Middle slat
    group "mid-slat" {
      move (-0.65, 1.2, -0.7)
      face (1, 0, 0)
      profile rect(0.08, 0.3)
      draw 1.3
    }
  }
}
```
