import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',       // 👈 Ensure build output is in /dist
    assetsDir: 'assets',  // 👈 Keeps static files under /dist/assets
    sourcemap: false,     // optional, can help debugging if true
  },
  server: {
    port: 3000,           // local dev port
    open: true,           // auto-open browser on `npm run dev`
  }
})
