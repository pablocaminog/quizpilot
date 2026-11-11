// @cloudflare/vite-plugin removes `assets` from the emitted deploy config when
// the Vite build itself produced no assets — QuizPilot's assets come from the
// separate `astro build` (dist/client), so re-declare them here. Paths are
// relative to the emitted config file (dist/quizpilot/wrangler.json).
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'dist/quizpilot/wrangler.json';
const config = JSON.parse(readFileSync(path, 'utf-8'));
config.assets = {
  directory: '../../dist/client',
  binding: 'ASSETS',
  not_found_handling: 'single-page-application',
  run_worker_first: ['/api/*', '/ws/*'],
};
// Production deploys from this checkout pass the account's D1 id via env so
// it never lands in the committed wrangler.jsonc (Deploy Button provisions its own).
if (process.env.QUIZPILOT_D1_ID) {
  config.d1_databases = config.d1_databases.map((d) => ({ ...d, database_id: process.env.QUIZPILOT_D1_ID }));
}
writeFileSync(path, JSON.stringify(config, null, 2));
console.log('patched assets into', path);
