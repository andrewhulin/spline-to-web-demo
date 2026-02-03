import { useMemo, useEffect } from 'react'
import * as THREE from 'three'

/**
 * Loads an image URL into a Three.js texture and returns a MeshStandardMaterial.
 * Uses the imperative Three.js TextureLoader instead of drei's useTexture
 * so we can handle arbitrary URLs (including cross-origin) without Suspense issues.
 */
export function useImageMaterial(imageUrl: string | null): THREE.MeshStandardMaterial | null {
  const material = useMemo(() => {
    if (!imageUrl) return null

    const texture = new THREE.TextureLoader().load(imageUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
    })

    texture.colorSpace = THREE.SRGBColorSpace

    return new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.FrontSide,
    })
  }, [imageUrl])

  // Dispose old material when URL changes or component unmounts
  useEffect(() => {
    return () => {
      if (material) {
        material.map?.dispose()
        material.dispose()
      }
    }
  }, [material])

  return material
}

/**
 * Creates materials for multiple image overrides.
 * Takes a map of { frameName: imageUrl } and returns { frameName: Material }.
 */
export function useImageMaterials(
  imageMap: Record<string, string>
): Record<string, THREE.Material> {
  const materials = useMemo(() => {
    const result: Record<string, THREE.Material> = {}

    for (const [name, url] of Object.entries(imageMap)) {
      if (!url) continue

      const texture = new THREE.TextureLoader().load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.needsUpdate = true
      })

      texture.colorSpace = THREE.SRGBColorSpace

      result[name] = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.FrontSide,
      })
    }

    return result
  }, [JSON.stringify(imageMap)])

  useEffect(() => {
    return () => {
      for (const mat of Object.values(materials)) {
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.map?.dispose()
        }
        mat.dispose()
      }
    }
  }, [materials])

  return materials
}
