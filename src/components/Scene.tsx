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
