import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// Eigenstaendige Vitest-Config NUR fuer Tests — beeinflusst NICHT den
// @weweb/cli-Build (npm run build / npm run serve bleiben unveraendert).
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    // Vitest 4 startet jsdom mit opaque origin (about:blank) — dort gibt es
    // KEIN localStorage. Eine echte URL setzt eine Origin und aktiviert es.
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    // Hebt jsdoms localStorage aufs Global (Node >= 22 verdeckt es sonst).
    setupFiles: ['./vitest.setup.js'],
    include: ['src/**/*.test.js'],
  },
});
