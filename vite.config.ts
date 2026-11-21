/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }
import { serviceWorkerPlugin } from './build/swPlugin.ts'

// base: './' → uygulama GitHub Pages gibi alt klasörlerde de çalışır.
export default defineConfig({
  base: './',
  plugins: [react(), serviceWorkerPlugin()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  server: { host: true, port: 5173 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
