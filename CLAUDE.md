# Spline-to-Web Demo - Project Guide

## Project Overview
A web app that renders a Spline 3D scene (isometric mini room with art) using Spline's own runtime engine and allows dynamic modification of picture frame materials at runtime. Designed in Spline, controlled in code.

**Spline Scene URL:** `https://prod.spline.design/VqWic2mrtRRHtc62/scene.splinecode`

## Tech Stack
- **Build:** Vite + React + TypeScript
- **3D Runtime:** `@splinetool/react-spline` + `@splinetool/runtime` (Spline's own engine)
- **Material Overrides:** Three.js (accessed via Spline's internal `_scene`)
- **Styling:** Inline styles (fullscreen Spline canvas + absolute-positioned overlay panel)

## Project Structure
```
src/
├── App.tsx       # Spline viewer + debug panel + material override logic
└── main.tsx      # React entry point
```

## Architecture & Key Patterns

### Why Spline Runtime Instead of R3F Code Export

Spline offers two export paths:

1. **Code Export** (`@splinetool/loader` + R3F) — Exports raw Three.js geometry. The export explicitly warns: *"This export doesn't use the Spline engine. Some visual differences might be noticeable."* In practice, this caused major issues:
   - Spline's scene-level "Ambient Light" is NOT exported, leaving surfaces unlit
   - Materials use custom `onBeforeCompile` shader hooks that don't respond to standard Three.js lighting
   - Adding `<ambientLight>` or converting `MeshBasicMaterial` to `MeshStandardMaterial` did not fix the rendering gaps
   - Result: missing walls, floor, plant — anything not directly lit appeared invisible

2. **Viewer/React Export** (`@splinetool/react-spline`) — Uses Spline's own rendering engine. Pixel-perfect match with the Spline editor. This is the approach we use.

### Spline React Component

```tsx
import Spline from '@splinetool/react-spline'
import type { Application } from '@splinetool/runtime'

<Spline
  scene={SCENE_URL}
  onLoad={(app: Application) => { /* store ref */ }}
  onSplineMouseDown={(e) => { /* e.target.name */ }}
  style={{ width: '100%', height: '100%' }}
/>
```

- `onLoad` receives an `Application` instance — the Spline runtime engine
- `onSplineMouseDown` receives events with `target: SPEObject` containing `name`, `uuid`, etc.
- The component fills its container; wrap in a `div` with explicit dimensions

### Material Overrides via Internal Three.js Scene

Spline's `Application` object has an internal `_scene` property that is a standard `THREE.Scene`. This allows Three.js-level material swaps:

```tsx
const app = splineRef.current
const scene = (app as any)._scene
const mesh = scene.getObjectByName(meshName) as THREE.Mesh

// Store original material for later restoration
originals.set(meshName, mesh.material)

// Override with a texture-mapped material
const loader = new THREE.TextureLoader()
loader.load(imageUrl, (texture) => {
  texture.colorSpace = THREE.SRGBColorSpace
  mesh.material = new THREE.MeshStandardMaterial({
    map: texture,
    side: THREE.FrontSide,
    roughness: 0.5,
    metalness: 0.0,
  })
})
```

**Key details:**
- `_scene` is an undocumented internal — it works but could break in future Spline versions
- Original materials are stored in a `useRef<Map>` to enable restoration
- `THREE.TextureLoader` is used imperatively (no React Suspense needed)
- `texture.colorSpace = THREE.SRGBColorSpace` is required for correct colors
- The override `useEffect` depends on `[imageMap]` — re-runs when URLs change

### Click Handling

Spline's `onSplineMouseDown` provides the clicked object's name. We check against our frame map:

```tsx
const handleSplineMouseDown = (e: { target: SPEObject }) => {
  const name = e.target?.name
  if (name?.startsWith('picture-')) {
    setSelectedFrame(name)
    return
  }
  // Also check inner mesh names via FRAME_MESH_MAP reverse lookup
  for (const [frameName, meshName] of Object.entries(FRAME_MESH_MAP)) {
    if (name === meshName) {
      setSelectedFrame(frameName)
      return
    }
  }
}
```

### State Flow
```
App.tsx
├── State: imageMap Record<string, string>  (frame name → image URL)
├── State: selectedFrame string | null
├── Spline component (renders scene via Spline engine)
├── useEffect (applies material overrides via _scene when imageMap changes)
└── Debug panel (HTML overlay for frame selection + URL input)
```

## Scene Element Reference

### Picture Frames (Override Targets)
| Frame Group | Inner Canvas Mesh | Position |
|------------|------------------|----------|
| picture-1 | Rectangle2 | Back wall, left |
| picture-2 | Rectangle3 | Back wall, center |
| picture-3 | Rectangle4 | Right wall |
| picture-4 | Rectangle 41 | Right wall (has shape overlays) |
| picture-5 | Rectangle5 | Back wall, small right |
| picture-6 | Rectangle6 | Right wall |
| picture-7 | Rectangle7 | Back wall, large left (has shapes) |
| picture-8 | Rectangle 23 | On desk |

### Other Key Scene Elements
- **Walls** - Main room geometry (walls + floor)
- **table** - Desk with legs + top
- **chair** - Pink stool
- **plant** - Potted plant with leaf cubes
- **carpet** - Oval rug on floor
- **window** - Back wall window with frame
- **lamp** - Desk lamp
- **artboard** - Drawing board on desk
- **artboard-2** - Easel with painting
- **box** - Box near desk
- **bucket** - Bucket with pencils/brushes
- **Controls** - Color buttons: Purple, Yellow, Pink
- **UI panels** - text-ui, picture-ui, color-ui, material-ui
- **books** - book-green, book-red, book-yellow, book-blue
- **Sphere** - Decorative sphere

## Three.js Compatibility Notes

### Vite Plugin: `splineThreeCompat`
The `@splinetool/runtime` bundles `@splinetool/loader` internally, which uses the deprecated `mergeBufferGeometries` API (renamed to `mergeGeometries` in Three.js >= 0.156). A Vite plugin in `vite.config.ts` patches this at build time:

```ts
function splineThreeCompat(): Plugin {
  return {
    name: 'spline-three-compat',
    transform(code, id) {
      if (id.includes('@splinetool/loader') || id.includes('SplineLoader')) {
        return {
          code: code.replace(/mergeBufferGeometries/g, 'mergeGeometries'),
          map: null,
        }
      }
    },
  }
}
```

### Version Constraints
- `three@0.160.0` is used because `@splinetool/loader` needs `LinearEncoding` (removed in Three.js ~0.165)
- Three.js is still a direct dependency because we use `THREE.TextureLoader` and `THREE.MeshStandardMaterial` for material overrides

## Abandoned Approaches (Lessons Learned)

### R3F + `<primitive>` Approach
Replaced 1,377 lines of manual JSX with `<primitive object={scene}>` using `@splinetool/loader` + R3F. This renders the entire scene graph in one line, but still uses Three.js rendering (not Spline's engine). The fundamental problem — Spline's custom shader materials not responding to standard Three.js lighting — remained unsolved.

### Manual Ambient Light Addition
Added `<ambientLight>` and hemisphere lights to the R3F scene. Spline's materials use `onBeforeCompile` shader hooks that bypass standard Three.js lighting calculations, so this had no visible effect.

### MeshBasicMaterial → MeshStandardMaterial Conversion
Traversed the scene to convert all `MeshBasicMaterial` to `MeshStandardMaterial`. While this makes meshes theoretically light-responsive, the converted materials lost Spline's custom shader effects, resulting in incorrect appearance.

## Commands
- `npm run dev` - Start dev server
- `npm run build` - TypeScript check + production build
- `npm run preview` - Preview production build

## Skills Reference
The `Skills/` directory contains reference material:
- `Skills/r3f-skills-main/skills/` - R3F materials, textures, loaders, fundamentals, interaction
- `Skills/threejs-skills-main/skills/` - Raw Three.js equivalents
- `Skills/cc-skills-main/advanced-frontend-skill/SKILL.md` - Premium UI/UX patterns

## Git Workflow
- Branch: `claude/spline-r3f-integration-86GpI`
- Push: `git push -u origin claude/spline-r3f-integration-86GpI`
- Commit style: concise, imperative, describe the "why"
