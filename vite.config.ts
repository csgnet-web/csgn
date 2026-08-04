import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * Split the big, slow-moving dependencies out of the entry chunk.
         *
         * Routes are already lazy, so what was left in `index` was almost
         * entirely libraries — and every one-line copy change shipped all ~250KB
         * of them again with a new hash, because app code and vendor code shared
         * a file. Separating them means a normal deploy invalidates the small
         * app chunk and returning visitors keep React, Firebase and the rest
         * from cache.
         *
         * Grouped rather than one-chunk-per-package on purpose: these four
         * always load together on first paint, and dozens of tiny chunks would
         * trade the caching win for request overhead.
         */
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/app-check'],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
    // The one chunk that legitimately exceeds the default 500KB warning is the
    // Solana web3 bundle, and it is already isolated to the single route that
    // needs it (/participate) rather than loaded on first paint. Raised so the
    // warning stays meaningful instead of firing on every build.
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
