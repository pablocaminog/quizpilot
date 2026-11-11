import { defineConfig } from 'vite';
import { flue, flueWorkerConfig } from '@flue/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

// Flue scans 'use agent' modules under src/worker and merges its generated
// bindings into .flue-vite.wrangler.jsonc; cloudflare() consumes it and
// emits the Worker bundle plus dist/wrangler.json.
export default defineConfig({
  plugins: [
    flue({
      app: 'src/worker/app.js',
      cloudflare: 'src/worker/cloudflare.js',
      providers: ['cloudflare'],
    }),
    cloudflare({ config: flueWorkerConfig() }),
  ],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
});
