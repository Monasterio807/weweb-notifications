import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';
const hier = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: hier,
  base: './',
  plugins: [vue()],
  build: { outDir: process.env.HARNESS_OUT, emptyOutDir: true },
});
