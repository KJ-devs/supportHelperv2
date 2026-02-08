/**
 * Vite config for CDN build
 * Produces a single IIFE bundle for <script> tag usage
 *
 * Build: pnpm --filter @support-helper/sdk-web build:cdn
 * Output: dist/cdn/sdk.iife.js
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist/cdn',
    lib: {
      entry: resolve(__dirname, 'src/widget/index.ts'),
      name: 'SupportHelper',
      formats: ['iife'],
      fileName: () => 'sdk.iife.js',
    },
    rollupOptions: {
      output: {
        // No external dependencies for CDN build - bundle everything
        inlineDynamicImports: true,
      },
    },
    // Minify for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console.warn for SDK warnings
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
    },
    // Generate sourcemap
    sourcemap: true,
    // Empty the output dir
    emptyOutDir: true,
  },
  define: {
    // Ensure we don't include Vue/React specific code in CDN build
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
