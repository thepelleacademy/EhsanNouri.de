import { defineConfig } from 'vite';

// base './' => works on github.io/<repo> AND on a custom domain (ehsannouri.de)
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
});
