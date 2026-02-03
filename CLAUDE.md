# Spline-to-Web Demo - Project Guide

## Project Overview
A React Three Fiber web app that renders a Spline 3D scene (isometric mini room with art) and allows dynamic modification of scene elements at runtime. Designed in Spline, controlled in code.

**Spline Scene URL:** `https://prod.spline.design/VqWic2mrtRRHtc62/scene.splinecode`

## Tech Stack
- **Build:** Vite + React + TypeScript
- **3D Runtime:** Three.js via `@react-three/fiber` (R3F) + `@react-three/drei`
- **Scene Loading:** `@splinetool/r3f-spline` + `@splinetool/loader`
- **Styling:** Plain CSS (minimal UI overlay)

## Project Structure
```
src/
├── App.tsx                    # Canvas wrapper + HTML UI overlay
├── App.css                    # Fullscreen canvas + overlay styles
├── main.tsx                   # React entry point
├── components/
│   ├── Scene.tsx              # Spline scene (from exported code, with overrides)
│   └── DynamicImage.tsx       # Texture-swapped mesh component
├── hooks/
│   └── useImageTexture.ts     # Hook for loading images as Three.js materials
└── types/
    └── spline.ts              # TypeScript types for nodes/materials
public/
└── images/                    # Sample images for demo
```

## Architecture & Key Patterns

### Spline + R3F Integration
The `@splinetool/r3f-spline` package provides a `useSpline` hook:
```tsx
const { nodes, materials } = useSpline(sceneUrl)
```
- `nodes`: Object of named scene elements with `.geometry` property
- `materials`: Object of named materials
- Pattern: `<mesh geometry={nodes.Name.geometry} material={materials['Mat Name']} />`
- Wrap scene in `<group {...props} dispose={null}>` to prevent resource cleanup

### Dynamic Material Override System
The core feature: swapping Spline materials with custom image textures at runtime.

**Pattern:** The Scene component accepts a `materialOverrides` map. For any mesh with an override, use the override material instead of the Spline default:
```tsx
<mesh
  geometry={nodes.Rectangle6.geometry}
  material={overrides['picture-6'] ?? materials.paper}
/>
```

**Image as material:** Use `useTexture` from `@react-three/drei` to load images, then create a `MeshStandardMaterial` with the texture as its `map`. Set `texture.colorSpace = THREE.SRGBColorSpace` for correct colors.

### State Flow
```
App.tsx (state: overrides map)
  └── Scene.tsx (receives overrides, applies to meshes)
       └── Each mesh checks overrides[name] ?? defaultMaterial
```

## Scene Element Reference

### Picture Frames (Primary Override Targets)
| Frame Group | Inner Canvas Mesh | Default Material | Position |
|------------|------------------|-----------------|----------|
| picture-1 | Rectangle2 | paper | Back wall, left |
| picture-2 | Rectangle3 | red-6 | Back wall, center |
| picture-3 | Rectangle4 | paper | Right wall |
| picture-4 | Rectangle 41 | red-5 | Right wall (has shape overlays) |
| picture-5 | Rectangle5 | paper | Back wall, small right |
| picture-6 | Rectangle6 | paper | Right wall (selected in Spline screenshot) |
| picture-7 | Rectangle7 | red-5 | Back wall, large left (has shapes) |
| picture-8 | Rectangle 23 | Rectangle 23 Material | On desk |

### Other Key Scene Elements
- **Walls** - Main room geometry (material: `Walls Material`)
- **table** - Desk with artboard, lamp, pen holder, books
- **chair** - Pink stool
- **plant** - Potted plant, right side
- **carpet** - Oval rug on floor
- **window** - Back wall window
- **lamp** - Desk lamp with multiple cylinder parts
- **artboard** - Drawing board on desk
- **artboard-2** - Easel with painting (has complex shape overlays)
- **Controls** - Bottom buttons: Color Purple, Color Yellow, Color Pink
- **UI panels** - text-ui, picture-ui, color-ui, material-ui (floating UI elements in scene)

### Material Names (from Spline)
Key materials in the scene: `paper`, `red-1` through `red-6`, `table`, `chair-ao`, `table-ao`, `artboard-ao`, `plant-green`, `Walls Material`, `UI panel-blue`, `ui-color`, `green`

## R3F Development Guidelines

### Camera
The scene uses an `OrthographicCamera` with zoom `0.24`, positioned at `[-3662.89, 2379.99, 3678.25]` with rotation `[-0.54, -0.71, -0.37]`. This creates the isometric view.

### Materials in R3F
- `meshStandardMaterial` - PBR, recommended for realistic results
- `meshBasicMaterial` - No lighting, flat colors, fast
- Use `useTexture` from drei for image loading (supports Suspense)
- Texture configuration: `wrapS`, `wrapT`, `repeat`, `offset`, `colorSpace`
- Dynamic updates: use refs + `useFrame` for per-frame material changes

### Textures
- Load with `useTexture('/path/to/image.jpg')` from `@react-three/drei`
- For color/albedo textures: `texture.colorSpace = THREE.SRGBColorSpace`
- For data textures (normal, roughness): leave as `LinearSRGBColorSpace`
- Preload critical textures: `useTexture.preload('/path')`
- Use Suspense boundaries for loading states

### Performance
- Reuse materials: same material instance = batched draw calls
- Use `useMemo` for materials/textures that don't change every frame
- Wrap loaded scene in `dispose={null}` to prevent auto-cleanup
- Use simpler materials when possible (Basic > Lambert > Standard > Physical)
- Limit texture sizes to 1024-2048px for web

### Loading & Suspense
```tsx
<Suspense fallback={<LoadingFallback />}>
  <Scene />
</Suspense>
```
Use `useProgress` from drei for loading progress display.

## Commands
- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run preview` - Preview production build

## Skills Reference
The `Skills/` directory contains comprehensive reference material:
- `Skills/r3f-skills-main/skills/r3f-materials/SKILL.md` - R3F materials guide
- `Skills/r3f-skills-main/skills/r3f-textures/SKILL.md` - R3F textures guide
- `Skills/r3f-skills-main/skills/r3f-loaders/SKILL.md` - R3F asset loading
- `Skills/r3f-skills-main/skills/r3f-fundamentals/SKILL.md` - R3F Canvas, hooks, setup
- `Skills/r3f-skills-main/skills/r3f-interaction/SKILL.md` - R3F events, controls
- `Skills/r3f-skills-main/skills/r3f-animation/SKILL.md` - R3F animation patterns
- `Skills/r3f-skills-main/skills/r3f-lighting/SKILL.md` - R3F lighting guide
- `Skills/threejs-skills-main/skills/` - Raw Three.js equivalents
- `Skills/cc-skills-main/advanced-frontend-skill/SKILL.md` - Premium UI/UX patterns

## Git Workflow
- Branch: `claude/spline-r3f-integration-86GpI`
- Push: `git push -u origin claude/spline-r3f-integration-86GpI`
- Commit style: concise, imperative, describe the "why"
