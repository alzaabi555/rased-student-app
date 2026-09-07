import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const isPwa = mode === 'pwa'

  return {
    // Android/Capacitor keeps relative paths. GitHub Pages uses the repository path.
    base: isPwa ? '/rased-student-app/' : './',
    plugins: [
      react(),
      ...(isPwa
        ? [
            VitePWA({
              registerType: 'autoUpdate',
              injectRegister: 'auto',
              includeAssets: [
                'favicon.ico',
                'apple-touch-icon.png',
                'pwa-192x192.png',
                'pwa-512x512.png',
                'pwa-maskable-512x512.png',
              ],
              manifest: {
                id: '/rased-student-app/',
                name: 'راصد الطالب',
                short_name: 'راصد الطالب',
                description: 'منصة راصد للطالب: الألعاب التعليمية والاختبارات والمهام والمراجعات.',
                lang: 'ar',
                dir: 'rtl',
                start_url: '/rased-student-app/',
                scope: '/rased-student-app/',
                display: 'standalone',
                orientation: 'any',
                background_color: '#f8fafc',
                theme_color: '#2563eb',
                icons: [
                  {
                    src: 'pwa-192x192.png',
                    sizes: '192x192',
                    type: 'image/png',
                    purpose: 'any',
                  },
                  {
                    src: 'pwa-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'any',
                  },
                  {
                    src: 'pwa-maskable-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                  },
                ],
              },
              workbox: {
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
                navigateFallback: '/rased-student-app/index.html',
                navigateFallbackDenylist: [/^\/__\//],
                globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg,gif,woff,woff2,mp3,ogg,wav,json}'],
                maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
                runtimeCaching: [
                  {
                    // Never cache live student, exam, game-question, or result requests.
                    urlPattern: /^https:\/\/script\.google\.com\//i,
                    handler: 'NetworkOnly',
                  },
                  {
                    urlPattern: /^https:\/\/script\.googleusercontent\.com\//i,
                    handler: 'NetworkOnly',
                  },
                  {
                    urlPattern: ({ request }) => request.destination === 'image' || request.destination === 'audio',
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'rased-student-game-assets-v1',
                      expiration: {
                        maxEntries: 500,
                        maxAgeSeconds: 30 * 24 * 60 * 60,
                      },
                      cacheableResponse: { statuses: [0, 200] },
                    },
                  },
                ],
              },
            }),
          ]
        : []),
    ],
  }
})
