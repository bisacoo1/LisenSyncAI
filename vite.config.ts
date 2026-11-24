import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import ttsHandler from './api/tts'

type LocalApiResponse = {
  headersSent: boolean
  status(code: number): LocalApiResponse
  setHeader(name: string, value: string): void
  end(body?: string | Uint8Array): void
}

function localTtsApi(): Plugin {
  return {
    name: 'local-tts-api',
    configureServer(server) {
      server.middlewares.use('/api/tts', (request, response, next) => {
        const apiResponse: LocalApiResponse = {
          get headersSent() {
            return response.headersSent
          },
          status(code: number) {
            response.statusCode = code
            return apiResponse
          },
          setHeader(name: string, value: string) {
            response.setHeader(name, value)
          },
          end(body?: string | Uint8Array) {
            response.end(body)
          },
        }

        if (request.method !== 'POST') {
          void ttsHandler({ method: request.method }, apiResponse)
          return
        }

        const chunks: Buffer[] = []
        request.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
        request.on('end', () => {
          let body: unknown
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          } catch {
            response.statusCode = 400
            response.setHeader('Content-Type', 'application/json; charset=utf-8')
            response.end(JSON.stringify({ error: 'A JSON request body is required.' }))
            return
          }
          void ttsHandler({ method: request.method, body }, apiResponse)
        })
        request.on('error', next)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localTtsApi()],
  worker: { format: 'es' },
  server: { host: '0.0.0.0', allowedHosts: ['.e2b.app'] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
