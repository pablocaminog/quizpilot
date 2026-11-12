# QuizPilot agent notes

- Spec: `QUIZPILOT_PLAN.md`. Product truth: `PRODUCT.md`. Visual system: `DESIGN.md`. UI direction contract: `.impeccable/surfaces/`.
- JavaScript/JSX only. Do not add TypeScript.
- Commands: `npm run build`, `npm test` (node:test unit), `npm run test:integration` (builds, local D1 migration, real Wrangler Worker, HTTP and WebSocket flow), `npm run package` (deploy dry-run). `npm run check` runs all of them.
- Dev: `npm run dev:worker` (port 8787) plus `npm run dev:ui` (Astro proxies `/api` and `/ws`).
- The Worker build emits `dist/quizpilot/wrangler.json`; `scripts/patch-worker-config.mjs` re-injects the assets config. `wrangler.jsonc` intentionally has no `main` (Flue supplies the entry).
- `package.json` overrides pin `@earendil-works/pi-*` to 1.4.0 (1.5.x breaks @flue/runtime 2.3.0).
- Kitesurf (`BROWSER`, remote) and Workers AI only work with Cloudflare credentials; locally they fail honestly with `SOURCE_UNREADABLE` / `AGENT_RUN_FAILED`.
- `src/shared/protocol.js` is the single source of truth for routes, error codes, and WebSocket events.
- Production deploy (account owner's machine): `QUIZPILOT_D1_ID=<d1 id> npm run build`, then `CLOUDFLARE_ACCOUNT_ID=<account> npm run deploy` (wrangler deploy, then D1 migrations by binding `DB`; both follow the `.wrangler/deploy` redirect to `dist/quizpilot/wrangler.json`). The Deploy Button runs the same `build` + `deploy` scripts. Get the D1 id with `npx wrangler d1 list`; never commit it.
- Game settings: defaults/choices in `GAME_SETTINGS_DEFAULTS`/`GAME_SETTINGS_CHOICES` (protocol.js). Partial `PUT /settings` merges over stored settings. QuizRoom drives auto-close/auto-advance with a single DO alarm (`state.pending`); `normalizeState` keeps pre-settings rooms working.
