import { defineConfig } from 'vite';

export default defineConfig({
  // Base path for GitHub Pages - change 'cpu-sim' to your repo name
  base: '/cpu-sim/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
