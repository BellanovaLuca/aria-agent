import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/email': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/email/, ''),
      },
      '/transcripts': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/token': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
})
