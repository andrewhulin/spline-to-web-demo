import { useEffect, useRef, useCallback } from 'react'
import { useLoader, useGraph } from '@react-three/fiber'
import SplineLoader from '@splinetool/loader'
import { OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'

const SCENE_URL =
  'https://prod.spline.design/VqWic2mrtRRHtc62/scene.splinecode'

// Frame group name -> inner canvas mesh name
const FRAME_MESH_MAP: Record<string, string> = {
  'picture-1': 'Rectangle2',
  'picture-2': 'Rectangle3',
  'picture-3': 'Rectangle4',
  'picture-4': 'Rectangle 41',
  'picture-5': 'Rectangle5',
  'picture-6': 'Rectangle6',
  'picture-7': 'Rectangle7',
  'picture-8': 'Rectangle 23',
}

interface SceneProps {
  materialOverrides?: Record<string, THREE.Material>
  onMeshClick?: (name: string) => void
}

export default function Scene({
  materialOverrides = {},
  onMeshClick,
  ...props
}: SceneProps) {
  const scene = useLoader(SplineLoader as any, SCENE_URL)
  const { nodes } = useGraph(scene as THREE.Object3D)

  const originalMaterialsRef = useRef<Map<string, THREE.Material>>(new Map())
  const patchedRef = useRef(false)

  // Ensure Spline's ambient light is active and materials are lit
  useEffect(() => {
    if (patchedRef.current) return
    patchedRef.current = true

    const s = scene as any

    // Check if Spline's built-in HemisphereLight ("Default Ambient Light") is in the scene
    let hasAmbient = false
    s.traverse((obj: THREE.Object3D) => {
      if ((obj as any).isHemisphereLight || (obj as any).isAmbientLight) {
        hasAmbient = true
      }
    })

    // If no ambient light found, the export didn't include it — add one
    // matching Spline's defaults: HemisphereLight(0xD3D3D3, 0x828282, 0.75)
    if (!hasAmbient) {
      const hemi = new THREE.HemisphereLight(0xd3d3d3, 0x828282, 0.75)
      hemi.name = 'Default Ambient Light'
      s.add(hemi)
    }

    // Convert MeshBasicMaterial → MeshStandardMaterial so meshes respond to lights.
    // SplineLoader sometimes creates MeshBasicMaterial for scene geometry, which is
    // fully unlit and ignores all light sources in the scene.
    s.traverse((obj: THREE.Object3D) => {
      if (!(obj as THREE.Mesh).isMesh) return
      const mesh = obj as THREE.Mesh
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

      mats.forEach((mat, idx) => {
        if (mat.type !== 'MeshBasicMaterial') return

        const basic = mat as THREE.MeshBasicMaterial
        const standard = new THREE.MeshStandardMaterial({
          color: basic.color,
          map: basic.map,
          alphaMap: basic.alphaMap,
          transparent: basic.transparent,
          opacity: basic.opacity,
          side: basic.side,
          visible: basic.visible,
          toneMapped: basic.toneMapped,
          roughness: 0.9,
          metalness: 0.0,
        })
        standard.name = basic.name

        if (Array.isArray(mesh.material)) {
          mesh.material[idx] = standard
        } else {
          mesh.material = standard
        }
      })
    })
  }, [scene])

  // Apply material overrides imperatively
  useEffect(() => {
    const originals = originalMaterialsRef.current

    // Capture original materials on first encounter
    for (const meshName of Object.values(FRAME_MESH_MAP)) {
      const node = nodes[meshName]
      if (node && (node as THREE.Mesh).isMesh && !originals.has(meshName)) {
        originals.set(meshName, (node as THREE.Mesh).material as THREE.Material)
      }
    }

    // Apply overrides where present, restore originals where not
    for (const [frameName, meshName] of Object.entries(FRAME_MESH_MAP)) {
      const node = nodes[meshName]
      if (!node || !(node as THREE.Mesh).isMesh) continue

      const mesh = node as THREE.Mesh
      const override = materialOverrides[frameName]
      if (override) {
        mesh.material = override
      } else {
        const original = originals.get(meshName)
        if (original) {
          mesh.material = original
        }
      }
    }
  }, [materialOverrides, nodes])

  // Click handler: walk up parent chain to find picture frame group
  const handleClick = useCallback(
    (e: any) => {
      e.stopPropagation()
      let current: THREE.Object3D | null = e.object
      while (current) {
        if (current.name?.startsWith('picture-')) {
          onMeshClick?.(current.name)
          return
        }
        current = current.parent
      }
    },
    [onMeshClick]
  )

  return (
    <>
      <color attach="background" args={['#f3cad4']} />
      <ambientLight intensity={0.5} color="#eaeaea" />
      <group {...props} dispose={null}>
        <primitive object={scene} onClick={handleClick} />
      </group>
      <OrthographicCamera
        makeDefault
        zoom={0.24}
        far={100000}
        near={-100000}
        position={[-3662.89, 2379.99, 3678.25]}
        rotation={[-0.54, -0.71, -0.37]}
      />
    </>
  )
}
