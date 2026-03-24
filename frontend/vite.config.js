import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',  // Core FastAPI backend
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/campaign-api': {
        target: 'http://127.0.0.1:8001',  // Campaign service backend
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/campaign-api/, ''),
      },
      '/chatbot-api': {
        target: 'https://chatbot-be-three.vercel.app',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/chatbot-api/, ''),
      },
    },
  },
})

