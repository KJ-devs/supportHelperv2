import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        widget: resolve(__dirname, 'src/widget/index.ts'),
        react: resolve(__dirname, 'src/react/index.ts'),
        vue: resolve(__dirname, 'src/vue/index.ts'),
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // Externalize React and Vue - they should be provided by the consuming app
      external: ['react', 'vue'],
      output: {
        // Provide global variables to use in the UMD build
        globals: {
          react: 'React',
          vue: 'Vue',
        },
        // Preserve the entry structure in output
        entryFileNames: '[name].[format].js',
        chunkFileNames: 'chunks/[name]-[hash].[format].js',
      },
    },
    // Generate sourcemaps
    sourcemap: true,
    // Minify
    minify: 'esbuild',
  },
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      outDir: 'dist',
      // Generate declaration files for all entries
      rollupTypes: true,
    }),
  ],
});
