import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Leitor de Livro PDF',
        short_name: 'Leitor PDF',
        description: 'Leitor de PDF com experiência de livro físico sobre escrivaninha aconchegante',
        theme_color: '#1a0f0a',
        background_color: '#140b07',
        display: 'standalone',
        orientation: 'any',
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,mjs}']
      }
    })
  ],
  optimizeDeps: {
    include: ['pdfjs-dist', 'page-flip', 'idb-keyval']
  }
});
