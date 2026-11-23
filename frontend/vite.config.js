import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      injectRegister: 'script',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'branding/SIVEC_isotipo.svg', 'icons/*.png'],
      manifest: {
        id: '/',
        name: 'SIVEC · Deporte, cultura y veeduría',
        short_name: 'SIVEC',
        description: 'Oferta deportiva y cultural y veeduría ciudadana de Apartadó.',
        lang: 'es-CO',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#173f35',
        background_color: '#f4f7f5',
        icons: [
          { src: '/icons/sivec-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/sivec-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/sivec-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,webp,woff2}'],
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        runtimeCaching: [{
          urlPattern: ({ url, sameOrigin }) => sameOrigin
            && /^\/api\/(?:escenarios|disciplinas(?:\/(?:activas|cronograma))?)\/?$/.test(url.pathname),
          method: 'GET',
          handler: 'NetworkFirst',
          options: {
            cacheName: 'sivec-consultas-publicas-v1',
            cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 },
          },
        }],
      },
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
})