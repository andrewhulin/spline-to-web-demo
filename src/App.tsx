import { useState, useCallback, useRef, useEffect } from 'react'
import Spline from '@splinetool/react-spline'
import type { SPEObject } from '@splinetool/react-spline'
import type { Application } from '@splinetool/runtime'
import * as THREE from 'three'

const SCENE_URL =
  'https://prod.spline.design/VqWic2mrtRRHtc62/scene.splinecode'

const PICTURE_FRAMES = [
  'picture-1',
  'picture-2',
  'picture-3',
  'picture-4',
  'picture-5',
  'picture-6',
  'picture-7',
  'picture-8',
] as const

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

export default function App() {
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null)
  const [imageMap, setImageMap] = useState<Record<string, string>>({})
  const [inputUrl, setInputUrl] = useState('')
  const [sceneReady, setSceneReady] = useState(false)
  const splineRef = useRef<Application | null>(null)
  const originalTexturesRef = useRef<Map<string, string | Uint8Array>>(new Map())

  const handleSplineLoad = useCallback((app: Application) => {
    splineRef.current = app
    // Small delay to ensure Spline's internal scene is fully populated
    setTimeout(() => setSceneReady(true), 200)
  }, [])

  const handleSplineMouseDown = useCallback(
    (e: { target: SPEObject }) => {
      const name = e.target?.name
      if (!name) return

      if (name.startsWith('picture-')) {
        setSelectedFrame(name)
        return
      }

      for (const [frameName, meshName] of Object.entries(FRAME_MESH_MAP)) {
        if (name === meshName) {
          setSelectedFrame(frameName)
          return
        }
      }
    },
    []
  )

  // Apply material overrides via Spline's API (texture layers) with Three.js fallback
  useEffect(() => {
    const app = splineRef.current
    if (!app || !sceneReady) return

    const originals = originalTexturesRef.current
    let rafId: number | null = null
    const threejsOverrides = new Map<string, { mesh: THREE.Mesh; material: THREE.Material }>()

    const applyOverrides = async () => {
      for (const [frameName, meshName] of Object.entries(FRAME_MESH_MAP)) {
        const imageUrl = imageMap[frameName]

        // Strategy 1: Spline API — findObjectByName + texture layer updateTexture
        const obj = app.findObjectByName(meshName)
        if (obj) {
          const material = (obj as any).material
          const layers = material?.layers
          if (layers) {
            const textureLayer = layers.find((l: any) => l.type === 'texture')
            if (textureLayer) {
              // Save original texture data on first encounter
              if (!originals.has(meshName)) {
                try {
                  const origData = textureLayer.texture?.image?.data
                  if (origData) originals.set(meshName, origData)
                } catch { /* ignore */ }
              }

              if (imageUrl) {
                try {
                  await textureLayer.updateTexture(imageUrl)
                } catch (err) {
                  console.warn(`[Override] Spline updateTexture failed for ${meshName}:`, err)
                }
              } else {
                // Restore original
                const origData = originals.get(meshName)
                if (origData) {
                  try { await textureLayer.updateTexture(origData) } catch { /* ignore */ }
                }
              }
              continue // Done for this frame via Spline API
            }
          }
        }

        // Strategy 2: Three.js — find mesh in _scene, apply material, reapply via rAF
        const scene = (app as any)._scene as THREE.Scene | undefined
        if (!scene) continue

        // Find mesh by name in Three.js scene
        let mesh: THREE.Mesh | null = null
        const byName = scene.getObjectByName(meshName)
        if (byName && (byName as THREE.Mesh).isMesh) {
          mesh = byName as THREE.Mesh
        }

        // Fallback: match by UUID from Spline object
        if (!mesh && obj) {
          const uuid = (obj as any).uuid
          if (uuid) {
            scene.traverse((child: THREE.Object3D) => {
              if (!mesh && child.uuid === uuid && (child as THREE.Mesh).isMesh) {
                mesh = child as THREE.Mesh
              }
            })
          }
        }

        if (!mesh) continue

        if (imageUrl) {
          const loader = new THREE.TextureLoader()
          loader.load(imageUrl, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace
            texture.needsUpdate = true
            const mat = new THREE.MeshBasicMaterial({
              map: texture,
              side: THREE.DoubleSide,
            })
            mesh!.material = mat
            threejsOverrides.set(meshName, { mesh: mesh!, material: mat })
          })
        } else {
          threejsOverrides.delete(meshName)
        }
      }

      // Start rAF loop to keep Three.js overrides applied
      // (Spline's engine may reset materials on its render frames)
      if (threejsOverrides.size > 0 && rafId === null) {
        const reapply = () => {
          for (const { mesh, material } of threejsOverrides.values()) {
            if (mesh.material !== material) {
              mesh.material = material
            }
          }
          rafId = requestAnimationFrame(reapply)
        }
        rafId = requestAnimationFrame(reapply)
      }
    }

    applyOverrides()

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      // Dispose Three.js override materials
      for (const { material } of threejsOverrides.values()) {
        if (material instanceof THREE.MeshBasicMaterial) material.map?.dispose()
        material.dispose()
      }
      threejsOverrides.clear()
    }
  }, [imageMap, sceneReady])

  const handleApplyImage = () => {
    if (!selectedFrame || !inputUrl.trim()) return
    setImageMap((prev) => ({ ...prev, [selectedFrame]: inputUrl.trim() }))
    setInputUrl('')
  }

  const handleClearImage = (frame: string) => {
    setImageMap((prev) => {
      const next = { ...prev }
      delete next[frame]
      return next
    })
    if (selectedFrame === frame) {
      setSelectedFrame(null)
    }
  }

  const handleClearAll = () => {
    setImageMap({})
    setSelectedFrame(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApplyImage()
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Spline
        scene={SCENE_URL}
        onLoad={handleSplineLoad}
        onSplineMouseDown={handleSplineMouseDown as any}
        renderOnDemand={false}
        style={{ width: '100%', height: '100%' }}
      />

      {/* Debug Panel */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 320,
          background: 'rgba(0, 0, 0, 0.85)',
          borderRadius: 12,
          padding: 16,
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 13,
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#888',
            marginBottom: 8,
            fontWeight: 600,
          }}
        >
          Debug Panel
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          Material Override
        </div>

        {/* Frame Selection */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', color: '#aaa', marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Select Frame
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {PICTURE_FRAMES.map((frame) => (
              <button
                key={frame}
                onClick={() => setSelectedFrame(frame)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: selectedFrame === frame
                    ? '1px solid #f472b6'
                    : '1px solid rgba(255,255,255,0.15)',
                  background: selectedFrame === frame
                    ? 'rgba(244, 114, 182, 0.2)'
                    : imageMap[frame]
                    ? 'rgba(74, 222, 128, 0.15)'
                    : 'rgba(255,255,255,0.05)',
                  color: selectedFrame === frame
                    ? '#f9a8d4'
                    : imageMap[frame]
                    ? '#86efac'
                    : '#ccc',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontFamily: 'monospace',
                }}
              >
                {frame.replace('picture-', 'P')}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: '#666' }}>
            or click a picture frame in the scene
          </div>
        </div>

        {/* Image URL Input */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', color: '#aaa', marginBottom: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Image URL {selectedFrame && <span style={{ color: '#f9a8d4' }}>({selectedFrame})</span>}
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedFrame ? 'Paste image URL...' : 'Select a frame first'}
              disabled={!selectedFrame}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: 12,
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
            <button
              onClick={handleApplyImage}
              disabled={!selectedFrame || !inputUrl.trim()}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: 'none',
                background: selectedFrame && inputUrl.trim()
                  ? '#f472b6'
                  : 'rgba(255,255,255,0.1)',
                color: selectedFrame && inputUrl.trim() ? '#000' : '#666',
                cursor: selectedFrame && inputUrl.trim() ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              Apply
            </button>
          </div>
        </div>

        {/* Active Overrides */}
        {Object.keys(imageMap).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ color: '#aaa', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Overrides
              </label>
              <button
                onClick={handleClearAll}
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.1)',
                  color: '#fca5a5',
                  cursor: 'pointer',
                  fontSize: 10,
                }}
              >
                Clear All
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(imageMap).map(([frame, url]) => (
                <div
                  key={frame}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#86efac', minWidth: 70 }}>
                    {frame}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 10,
                      color: '#888',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={url}
                  >
                    {url}
                  </span>
                  <button
                    onClick={() => handleClearImage(frame)}
                    style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#999',
                      cursor: 'pointer',
                      fontSize: 10,
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, color: '#666', fontSize: 11, lineHeight: 1.5 }}>
          Select a picture frame (P1-P8) then paste an image URL to replace its material. Green badges = active overrides.
        </div>
      </div>
    </div>
  )
}
