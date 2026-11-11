import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// The UI prerenders to dist/client. During development the Astro server
// proxies API and WebSocket traffic to the Worker dev server (dev:worker).
export default defineConfig({
  output: 'static',
  outDir: './dist/client',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
    server: {
      proxy: {
        '/api': 'http://localhost:8787',
        '/ws': { target: 'http://localhost:8787', ws: true },
      },
    },
  },
});
