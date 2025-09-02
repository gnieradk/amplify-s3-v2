import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',       // Ensure build output is in /dist
    assetsDir: 'assets',  // Keeps static files under /dist/assets
    sourcemap: false,     // optional
  },
  base: './',             // 👈 important for SPA hosting
  server: {
    port: 3000,
    open: true,
  }
})
