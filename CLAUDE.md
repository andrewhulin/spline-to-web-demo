# Spline-to-Web Demo - Project Guide

## Project Overview
A React Three Fiber web app that renders a Spline 3D scene (isometric mini room with art) and allows dynamic modification of scene elements at runtime. Designed in Spline, controlled in code.

**Spline Scene URL:** `https://prod.spline.design/VqWic2mrtRRHtc62/scene.splinecode`

## Tech Stack
- **Build:** Vite + React + TypeScript
- **3D Runtime:** Three.js 0.160 via `@react-three/fiber` (R3F) + `@react-three/drei`
- **Scene Loading:** `@splinetool/loader` (used directly via R3F's `useLoader`)
- **Styling:** Inline styles (fullscreen canvas + overlay panel)

## Project Structure
```
src/
├── App.tsx                    # Canvas wrapper + HTML debug panel overlay
├── main.tsx                   # React entry point
├── components/
│   └── Scene.tsx              # Spline scene via <primitive> + imperative overrides
└── hooks/
    └── useImageMaterial.ts    # Hook for loading image URLs as Three.js materials
```

## Architecture & Key Patterns

### Spline Scene Rendering: The `<primitive>` Approach

**Why `<primitive>` instead of manual JSX:**
The original approach manually wrote JSX for every mesh/group in the Spline scene (~1,377 lines). This was fragile — nodes were easily missed during conversion, causing missing elements. The `<primitive>` approach renders the entire Spline scene graph in one line, guaranteeing nothing is missing.

**How it works:**
```tsx
import { useLoader, useGraph } from '@react-three/fiber'
import SplineLoader from '@splinetool/loader'

// useSpline from @splinetool/r3f-spline is just these two calls:
const scene = useLoader(SplineLoader, SCENE_URL)
const { nodes } = useGraph(scene)

// Render the ENTIRE scene — all meshes, groups, lights, cameras
<primitive object={scene} />
```

- `scene` is the raw `THREE.Scene` containing the full hierarchy from the `.splinecode` file
- `nodes` is a flat map of `{ name: THREE.Object3D }` — live references into that scene graph
- Mutating `nodes['Rectangle2'].material` directly changes the in-scene mesh
- `useGraph` (from R3F) calls `buildGraph` which traverses the scene and creates the flat map

**Camera handling:**
Cameras inside `<primitive>` exist in the scene graph but are NOT activated by R3F as the rendering camera. An explicit `<OrthographicCamera makeDefault>` from `@react-three/drei` must be placed as a sibling:
```tsx
<>
  <group dispose={null}>
    <primitive object={scene} onClick={handleClick} />
  </group>
  <OrthographicCamera makeDefault zoom={0.24} ... />
</>
```

### Dynamic Material Override System (Imperative)

Since `<primitive>` renders the tree opaquely, material overrides are applied imperatively via `useEffect`:

```tsx
const originalMaterialsRef = useRef<Map<string, THREE.Material>>(new Map())

useEffect(() => {
  const originals = originalMaterialsRef.current

  // Capture original materials once
  for (const meshName of Object.values(FRAME_MESH_MAP)) {
    const node = nodes[meshName]
    if (node?.isMesh && !originals.has(meshName)) {
      originals.set(meshName, node.material)
    }
  }

  // Apply overrides or restore originals
  for (const [frameName, meshName] of Object.entries(FRAME_MESH_MAP)) {
    const mesh = nodes[meshName]
    if (!mesh?.isMesh) continue
    mesh.material = materialOverrides[frameName] ?? originals.get(meshName)
  }
}, [materialOverrides, nodes])
```

**Key details:**
- Original materials are stored in a `useRef<Map>` (not state — avoids re-renders)
- Captured on first encounter before any mutations
- When an override is removed, the original material is restored
- Three.js picks up material changes on the next frame automatically (continuous render loop)

### Click Handling via Event Bubbling

A single `onClick` on `<primitive>` handles all picture frame clicks. R3F raycasts to find the clicked mesh, then we walk up the Three.js parent chain:

```tsx
const handleClick = useCallback((e) => {
  e.stopPropagation()
  let current = e.object
  while (current) {
    if (current.name?.startsWith('picture-')) {
      onMeshClick?.(current.name)
      return
    }
    current = current.parent
  }
}, [onMeshClick])
```

### Image → Material Loading

The `useImageMaterials` hook in `src/hooks/useImageMaterial.ts` converts image URLs to Three.js materials:
- Uses `THREE.TextureLoader` imperatively (not drei's `useTexture`) to avoid Suspense issues with dynamic URLs
- Sets `texture.colorSpace = THREE.SRGBColorSpace` for correct colors
- Creates `MeshStandardMaterial` with the texture as its `map`
- Disposes textures and materials on cleanup

### State Flow
```
App.tsx (state: imageMap Record<string, string>)
  └── SceneWithOverrides (converts URLs → materials via useImageMaterials hook)
       └── Scene.tsx (receives Record<string, THREE.Material>, applies imperatively)
```

## Scene Element Reference

### Picture Frames (Override Targets)
| Frame Group | Inner Canvas Mesh | Default Material | Position |
|------------|------------------|-----------------|----------|
| picture-1 | Rectangle2 | paper | Back wall, left |
| picture-2 | Rectangle3 | red-6 | Back wall, center |
| picture-3 | Rectangle4 | paper | Right wall |
| picture-4 | Rectangle 41 | red-5 | Right wall (has shape overlays) |
| picture-5 | Rectangle5 | paper | Back wall, small right |
| picture-6 | Rectangle6 | paper | Right wall |
| picture-7 | Rectangle7 | red-5 | Back wall, large left (has shapes) |
| picture-8 | Rectangle 23 | Rectangle 23 Material | On desk |

### Other Key Scene Elements
- **Walls** - Main room geometry (walls + floor, material: `Walls Material`)
- **table** - Desk with 4 cylinder legs + rectangle top
- **chair** - Pink stool with 4 cube legs + cylinder seat
- **plant** - Potted plant with multiple leaf cubes
- **carpet** - Oval rug on floor (2 ellipses)
- **window** - Back wall window with frame
- **lamp** - Desk lamp with 5 cylinder parts
- **artboard** - Drawing board on desk with supports
- **artboard-2** - Easel with painting (has complex shape overlays, "画" group)
- **box** - Box near desk
- **bucket** - Bucket with pencils/brushes
- **Controls** - Color buttons: Purple, Yellow, Pink
- **UI panels** - text-ui, picture-ui, color-ui, material-ui (floating UI elements)
- **books** - book-green, book-red, book-yellow, book-blue
- **paper** - Sheet on desk
- **Sphere** - Decorative sphere

### Camera
OrthographicCamera "Camera 2": zoom=0.24, position=[-3662.89, 2379.99, 3678.25], rotation=[-0.54, -0.71, -0.37]. Creates the isometric view.

## Three.js Compatibility Notes

### @splinetool/loader + Three.js Version Issues
The `@splinetool/loader` uses deprecated Three.js APIs:

1. **`mergeBufferGeometries`** → renamed to `mergeGeometries` in Three.js >= 0.156
   - Fixed via Vite plugin in `vite.config.ts` that transforms the string at build time
   - The plugin matches files containing `@splinetool/loader` or `SplineLoader`

2. **`LinearEncoding`** → removed in Three.js >= 0.165 (approx)
   - Fixed by using `three@0.160.0` which still has this export

3. **Version constraints:**
   - `@react-three/fiber@9.x` requires `three >= 0.156`
   - `@react-three/drei@10.x` requires `three >= 0.159`
   - `@splinetool/loader` needs `LinearEncoding` (removed ~0.165)
   - **Sweet spot: `three@0.160.0`** satisfies all three

### Vite Plugin: `splineThreeCompat`
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

## Commands
- `npm run dev` - Start dev server
- `npm run build` - TypeScript check + production build
- `npm run preview` - Preview production build

## Skills Reference
The `Skills/` directory contains reference material:
- `Skills/r3f-skills-main/skills/r3f-materials/SKILL.md` - R3F materials guide
- `Skills/r3f-skills-main/skills/r3f-textures/SKILL.md` - R3F textures guide
- `Skills/r3f-skills-main/skills/r3f-loaders/SKILL.md` - R3F asset loading
- `Skills/r3f-skills-main/skills/r3f-fundamentals/SKILL.md` - R3F Canvas, hooks, setup
- `Skills/r3f-skills-main/skills/r3f-interaction/SKILL.md` - R3F events, controls
- `Skills/threejs-skills-main/skills/` - Raw Three.js equivalents
- `Skills/cc-skills-main/advanced-frontend-skill/SKILL.md` - Premium UI/UX patterns

## Git Workflow
- Branch: `claude/spline-r3f-integration-86GpI`
- Push: `git push -u origin claude/spline-r3f-integration-86GpI`
- Commit style: concise, imperative, describe the "why"
