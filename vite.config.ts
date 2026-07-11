import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// 開発サーバーでは Vite が CSS を <style> タグで注入するため、dev のときだけ
// CSP の style-src に 'unsafe-inline' を足す（本番ビルドの CSP は index.html のまま）
const relaxCspForDev = (): Plugin => ({
  name: 'relax-csp-for-dev',
  apply: 'serve',
  transformIndexHtml(html) {
    return html.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
  },
})

export default defineConfig({
  plugins: [
    relaxCspForDev(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      manifest: {
        name: 'Megroove',
        short_name: 'Megroove',
        description: '毎日のコーヒーを記録・分析するアプリ',
        theme_color: '#1a0a05',
        background_color: '#1a0a05',
        display: 'standalone',
        start_url: '.',
        orientation: 'portrait',
        lang: 'ja',
        shortcuts: [
          {
            name: '淹れる',
            url: './#/brew',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
        ],
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
    }),
  ],
  base: '/megroove-web/',
})
