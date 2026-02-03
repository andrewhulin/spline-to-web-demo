import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Plugin to fix @splinetool/loader compatibility with Three.js >= 0.156
 * where mergeBufferGeometries was renamed to mergeGeometries.
 */
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

export default defineConfig({
  plugins: [react(), splineThreeCompat()],
})
