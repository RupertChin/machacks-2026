import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // @mediapipe/tasks-vision has a malformed exports field that mixes
      // condition keys with subpath keys — invalid per Node.js spec.
      // Vite 8's Rolldown resolver enforces this strictly.
      // Alias directly to the ESM bundle to bypass the broken exports.
      '@mediapipe/tasks-vision': path.resolve(
        __dirname,
        'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs'
      ),
    },
  },
})
