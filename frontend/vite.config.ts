import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Cache app shell + assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Runtime caching for tile images (OpenStreetMap)
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/unpkg\.com\/leaflet/,
            handler: 'CacheFirst',
            options: { cacheName: 'leaflet-assets', expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 } },
          },
        ],
        // Don't precache large source maps
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
      manifest: {
        name: 'Juhudi Kilimo – Loan Officer Portal',
        short_name: 'Juhudi LO',
        description: 'Microfinance loan officer app for Juhudi Kilimo',
        theme_color: '#166534',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
        start_url: '/',
        scope: '/',
        categories: ['finance', 'business'],
      },
    }),
  ],
  server: {
    port: 5173,
    host: '0.0.0.0',   // Listen on all interfaces so LAN devices can connect
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable in production for security
  },
});
