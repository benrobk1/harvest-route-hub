import { VitePWA } from 'vite-plugin-pwa';

export const pwaConfig = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.png', 'robots.txt'],
  manifest: {
    name: 'Blue Harvests',
    short_name: 'Blue Harvests',
    description: 'Local farm to table marketplace with delivery logistics',
    theme_color: '#4a9da8',
    background_color: '#ffffff',
    display: 'standalone',
    start_url: '/',
    icons: [
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
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['food', 'shopping', 'business'],
    orientation: 'portrait-primary',
  },
  workbox: {
    maximumFileSizeToCacheInBytes: 7 * 1024 * 1024, // 7 MB (increased for mapbox-gl)
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24, // 24 hours
          },
          networkTimeoutSeconds: 10,
        },
      },
    ],
  },
  devOptions: {
    enabled: true,
    type: 'module',
  },
});
