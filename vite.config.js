import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('node_modules/xlsx')) return 'xlsx'
          if (id.includes('node_modules/html2canvas')) return 'html2canvas'
          if (id.includes('node_modules/jspdf-autotable')) return 'jspdf-autotable'
          if (id.includes('node_modules/jspdf')) return 'jspdf'
          if (id.includes('node_modules/@supabase')) return 'supabase'
          if (id.includes('node_modules/react')) return 'react-vendor'
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'logo_vd.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Vatra e Diturisë',
        short_name: 'Vatra',
        description: 'Vatra e Diturisë',
        lang: 'sq',
        theme_color: '#2e2c80',
        background_color: '#80a68a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [],
      },
    }),
  ],
})
