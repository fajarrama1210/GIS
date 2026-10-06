import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // Pisah chunk besar menjadi beberapa file kecil yang bisa lazy-load
    rollupOptions: {
      output: {
        manualChunks: {
          // Leaflet (peta) — hanya dimuat saat komponen peta dirender
          'vendor-leaflet': ['leaflet', 'react-leaflet'],
          // Chart.js — hanya dimuat saat komponen chart dirender
          'vendor-chart': ['chart.js', 'react-chartjs-2'],
          // React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Utilities
          'vendor-utils': ['axios', 'zustand', 'zod', 'lucide-react'],
        },
      },
    },
    // Naikkan warning limit karena vendor maps memang besar
    chunkSizeWarningLimit: 600,
  },
})
