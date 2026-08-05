import { defineConfig, configDefaults } from 'vitest/config'
import path from 'node:path'
import fs from 'node:fs'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

const pkg = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf-8'))
const externalDependencies = ['electron', ...Object.keys(pkg.dependencies || {})]

export default defineConfig({
  // Playwright owns tests/e2e (run via `npm run test:e2e`); keep them out of Vitest.
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  plugins: [
    react(),
    electron([
      {
        // Main process entry file of the Electron App.
        entry: 'electron/main.ts',
        onstart(options) {
          options.startup()
        },
        vite: {
          build: {
            sourcemap: true,
            minify: false,
            outDir: 'dist-electron',
            rollupOptions: {
              external: externalDependencies
            }
          },
          // Watch all electron source files so any IPC/service change restarts the app
          plugins: [{
            name: 'watch-electron',
            configureServer(server) {
              server.watcher.add('electron/**/*.ts')
            }
          }]
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            sourcemap: true,
            minify: false,
            outDir: 'dist-electron',
            // Electron's sandboxed renderer only supports a CommonJS preload.
            // The package is `"type": "module"`, so force a CJS build emitted as
            // `.cjs` (unambiguously CommonJS regardless of package "type").
            lib: {
              entry: path.resolve(import.meta.dirname, 'electron/preload.ts'),
              formats: ['cjs'],
              fileName: () => 'preload.cjs',
            },
          }
        }
      }
    ])
  ],
})
