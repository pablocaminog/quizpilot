# QuizPilot

A Kahoot-style live quiz app on Cloudflare. A host describes a learning goal,
picks a source (pasted text, a public web page rendered by Cloudflare Kitesurf,
a text document, or an original AI brief), reviews an AI-drafted quiz, publishes
it, and runs a real-time game over WebSockets.

## Deploy to Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/pablocaminog/quizpilot)

The button provisions the Worker, D1 database, R2 bucket, Durable Objects, and
Workers AI binding into **your own Cloudflare account**. It requires you to
authorize with Cloudflare — there is no anonymous deployment and no local setup
step — and needs no external model API key because quiz drafting runs on
Workers AI. It cannot create secrets; none are required.

## Architecture

- `src/worker/app.js` — Hono API: host sessions, quiz/source/question CRUD,
  publish, game creation, player join, WebSocket admission, and the Flue
  draft-run dispatch/SSE boundary.
- `src/worker/agents/quiz-drafter.js` — the single Flue agent (`'use agent'`,
  Workers AI `cloudflare/@cf/moonshotai/kimi-k2.6`, `quiz-authoring` skill).
- `src/worker/cloudflare.js` — `QuizRoom` Durable Object: hibernating
  WebSockets, server-authoritative timing/scoring, batched D1 persistence.
- `src/worker/domain.js` + `src/shared/protocol.js` — validation boundary and
  the single source of API/WebSocket contract names.
- `src/pages/index.astro` + `src/components/app-shell.jsx` — static Astro shell
  and the React island router (`/`, `/host/quiz/:quizId`, `/play/:joinCode`,
  `/game/:joinCode`).

## Develop

```bash
npm install
npm run dev:worker   # Worker + Flue agents in workerd (port 8787)
npm run dev:ui       # Astro dev server, proxies /api and /ws to :8787
npm test             # unit tests
npm run build && npm run test:integration   # real local Worker end-to-end
npm run package      # build + wrangler deploy --dry-run
```

URL sources require a remote Browser Run (Kitesurf) session during development,
so `wrangler dev --remote` (or `vite dev` with remote bindings) plus Cloudflare
credentials is needed to exercise that path; pasted-text sources work fully
locally. Deployed D1 migrations live in `migrations/`.
