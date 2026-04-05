# PolyForge

A DSL for creating low-poly 3D models. Write a `.pf` file, compile it to `.glb` (binary glTF).

## Install & Run

```bash
npm install
npm run build
node dist/cli/index.js build model.pf      # outputs model.glb
node dist/cli/index.js validate model.pf    # check syntax only
```

## How It Works

Think of it like a pen on a 3D workbench:

1. **Pick a brush shape** -- a 2D cross-section (`profile`)
2. **Position the pen** in 3D space (`move`, `face`)
3. **Draw strokes** that extrude geometry (`draw`)

## Quick Example

```
model "Tower" {
  color "stone"
  profile circle(0.8)
  face (0, 1, 0)

  // Main shaft
  draw 5

  // Tapered roof
  color "wood-dark"
  taper 0
  draw 2 segments 4
}
```

## Core Commands

| Command | What it does |
|---------|-------------|
| `profile circle(r)` | Set cross-section to a circle (hexagon at low-poly) |
| `profile rect(w, h)` | Rectangular cross-section |
| `profile diamond(w, h)` | Diamond/rhombus cross-section |
| `color "steel"` | Set color (named palette, hex `#RRGGBB`, or `rgb(r,g,b)`) |
| `color "gold" metallic 0.9 roughness 0.2` | Color with PBR properties |
| `move (x, y, z)` | Move cursor to absolute position |
| `shift (dx, dy, dz)` | Offset cursor relative to current position |
| `face (x, y, z)` | Set draw direction (auto-normalized) |
| `rotate 45` | Twist profile around the draw axis |
| `draw 3` | Extrude current profile 3 units forward |
| `draw (x, y, z)` | Extrude toward a point |
| `taper 0` | Shrink to nothing over the next draw |
| `taper 0.5 1.5` | Scale from 0.5x to 1.5x over the next draw |
| `arc 2 90` | Curved extrusion: radius 2, 90-degree turn |

## Symmetry with `mirror`

Duplicate geometry across a plane through the origin:

```
mirror x {
  move (1, 0, 0)
  draw 3
}
```

Multi-axis mirror for 4-way symmetry:

```
mirror x z {
  move (0.7, 0, 0.7)
  profile square(0.15)
  draw 2
}
```

## Branching with `save` / `restore`

Draw a branch, then return to where you were:

```
draw 5
save
  face (1, 0, 0)
  draw 1.5
restore
draw 3    // continues from the saved position
```

## Groups

Organize parts into named sections (maps to glTF nodes):

```
group "blade" {
  // ...
}
```

## Full Example: Sword

```
model "Iron Sword" {

  group "blade" {
    color "steel" metallic 0.7 roughness 0.3
    profile diamond(0.4, 0.15)
    draw 4

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
        taper 1 1.3
        draw 0.3
      }
    }

    group "grip" {
      move (0, -0.1, 0)
      face (0, -1, 0)
      color "leather" roughness 0.9
      profile circle(0.18)
      taper 1 1.15
      draw 0.9
      taper 1.15 1
      draw 0.9
    }

    group "pommel" {
      color "gold" metallic 0.9 roughness 0.2
      profile circle(0.25)
      draw 0.2
      taper 0.6
      draw 0.2
    }
  }
}
```

## More Info

See [DSL.md](DSL.md) for the full language reference, or browse the [interactive examples gallery](https://steven-ireland.github.io/polyforge/).
