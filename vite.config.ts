import { defineConfig, normalizePath } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: normalizePath(path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/*.wasm')),
          dest: 'onnx',
        },
        {
          src: normalizePath(path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/*.mjs')),
          dest: 'onnx',
        },
      ],
    }),
  ],
  optimizeDeps: {
    exclude: ['@mintplex-labs/piper-tts-web', 'onnxruntime-web'],
  },
  worker: { format: 'es' },
  server: { host: '0.0.0.0', allowedHosts: ['.e2b.app'] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
