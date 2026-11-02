import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base './' => works on github.io/<repo> AND on a custom domain (ehsannouri.de)
// Two pages: the site (index.html) and the admin panel (admin/index.html -> /admin/)
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
});
