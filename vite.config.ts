import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // ── Main process ────────────────────────────────────────────────
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            // BUGFIX: output as CommonJS so that createRequire('node-pty')
            // works correctly at runtime in the Electron main process.
            // ESM interop with native .node modules is unreliable.
            lib: {
              entry: 'electron/main.ts',
              formats: ['cjs'],
              fileName: () => 'main.js',
            },
            rollupOptions: {
              // Keep these as external — they are provided by Electron runtime
              external: [
                'electron',
                'node-pty',
                // Node built-ins
                'path', 'fs', 'os', 'net', 'url', 'module',
                'child_process', 'stream', 'events', 'util',
                'crypto', 'http', 'https', 'zlib', 'buffer',
              ],
              output: {
                format: 'cjs',
                entryFileNames: 'main.js',
              },
            },
          },
        },
      },
      {
        // ── Preload script ──────────────────────────────────────────────
        entry: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            lib: {
              entry: 'electron/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.js',
            },
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'preload.js',
              },
            },
          },
        },
        onstart(options) {
          // Reload renderer when preload changes in dev mode
          options.reload()
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    // Suppress the chunk-size warning (Three.js is large by design)
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Code-split Three.js and xterm into separate chunks for faster loads
        manualChunks: {
          'three':  ['three'],
          'xterm':  ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
          'react':  ['react', 'react-dom'],
        },
      },
    },
  },
})
