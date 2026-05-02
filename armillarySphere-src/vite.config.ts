import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  build: {
    outDir: '../armillarySphere',
    emptyOutDir: true,
    target: 'es2022',
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      manifest: false,
      includeAssets: ['manifest.webmanifest', 'icons/*.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,webmanifest,png,svg,jpg,bin,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.{test,spec}.ts'],
    environment: 'node',
    globals: true,
  },
});
