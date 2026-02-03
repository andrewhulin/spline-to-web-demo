import { Suspense, useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import Scene from './components/Scene'
import { useImageMaterials } from './hooks/useImageMaterial'

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

function SceneWithOverrides({
  imageMap,
  onMeshClick,
}: {
  imageMap: Record<string, string>
  onMeshClick: (name: string) => void
}) {
  const materialOverrides = useImageMaterials(imageMap)

  return (
    <Scene materialOverrides={materialOverrides} onMeshClick={onMeshClick} />
  )
}

export default function App() {
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null)
  const [imageMap, setImageMap] = useState<Record<string, string>>({})
  const [inputUrl, setInputUrl] = useState('')

  const handleMeshClick = useCallback((name: string) => {
    if (PICTURE_FRAMES.includes(name as any)) {
      setSelectedFrame(name)
    }
  }, [])

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
      <Canvas
        shadows
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <SceneWithOverrides
            imageMap={imageMap}
            onMeshClick={handleMeshClick}
          />
        </Suspense>
      </Canvas>

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
