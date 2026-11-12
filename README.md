# QuizPilot

Live quizzes drafted from your own material. Pick a source, let AI propose
cited questions, review them, then run a Kahoot-style game on a projector
while players answer from their phones.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/pablocaminog/quizpilot)

Runs entirely on Cloudflare: Workers, D1, R2, Durable Objects, Workers AI and
Browser Run. No external API keys.

## How it works

1. **Source.** Paste text, capture a public web page, upload a PDF, `.txt` or
   `.md` file, or write a brief for original questions.
2. **Draft.** An AI agent proposes multiple-choice questions. Each one quotes
   the passage it came from, so you can check it against the source.
3. **Review.** Edit questions, options, correct answers and timers. Questions
   from a source must keep at least one citation; quizzes written from a brief
   are marked AI-generated.
4. **Publish.** Publishing locks the questions and creates a game with a join
   code and QR code.
5. **Play.** The projector shows the question, timer and leaderboard. Players
   join at `/play/<code>` with a nickname. The server keeps time and scores
   answers, so clients can't cheat the clock.

Scoring: a correct answer earns between 500 and 1000 points depending on
speed. Ties are broken by total answer time.

### Game settings

Set per quiz in the Publish step. They can be changed after publishing and
apply to the next game you start.

| Setting | Options | Default |
|---|---|---|
| Answer time | Each question's own timer, or 10 / 20 / 30 / 60 s for all | Each question's timer |
| Get ready | Show the question alone for 0 / 3 / 5 s before answers unlock | 3 s |
| End early | Close the question once every connected player has answered | On |
| Next question | Wait for the host, or move on after 5 / 8 / 15 s (the host can hold) | Wait for the host |
| Leaderboard | Show it after each question (final results always show) | On |
| Shuffle | Question order and answer order, per game | Off |
| Speed bonus | Off gives a flat 1000 points per correct answer | On |
| Late joining | Let players join after the game has started | On |

Questions always close automatically when time runs out.

## Deploy

Click **Deploy to Cloudflare** above. Cloudflare will:

- copy this repository into your GitHub or GitLab account,
- create a D1 database (`DB`), an R2 bucket (`SOURCES`), the `QuizRoom` and
  quiz-drafter Durable Objects, and bind Workers AI (`AI`) and Browser Run
  (`BROWSER`),
- run `npm run build`, then `npm run deploy`, which deploys the Worker and
  applies the D1 migrations in `migrations/`.

You need a Cloudflare account and have to sign in; the button can't deploy
anonymously. No secrets are required. Workers AI and Browser Run usage is
billed to your account at Cloudflare's normal rates.

### Deploy from the command line

```bash
npm install
npx wrangler login
npx wrangler d1 create quizpilot-db
npx wrangler r2 bucket create quizpilot-sources
QUIZPILOT_D1_ID=<database id from d1 create> npm run build
npm run deploy
```

`QUIZPILOT_D1_ID` writes the database ID into the build output only, so it
never ends up in `wrangler.jsonc`.

## Limits

| | |
|---|---|
| PDF upload | 25 MB, must contain selectable text (scanned PDFs aren't supported) |
| `.txt` / `.md` upload | 512 KB |
| Pasted text | 60,000 characters |
| Questions per quiz | 2 to 20 |
| Options per question | 2 to 4 |
| Timer per question | 5 to 120 seconds |
| Player nickname | 1 to 30 characters |

## Develop

Requires Node 22 or newer.

```bash
npm install
npm run dev:worker   # Worker and agent in workerd on :8787
npm run dev:ui       # Astro dev server, proxies /api and /ws to :8787
```

Web-page capture, PDF conversion and AI drafting call Cloudflare remotely, so
they need `npx wrangler login`. Without it they fail with a clear error;
pasted text and the live game work fully offline.

```bash
npm test                    # unit tests
npm run test:integration    # builds, migrates a local D1, runs a real Worker end to end
npm run package             # build plus deploy dry run
npm run check               # all of the above
```

## Project layout

| Path | What it is |
|---|---|
| `src/worker/app.js` | Hono API: host sessions, quizzes, sources, questions, publishing, games, player join, WebSocket admission, draft streaming |
| `src/worker/agents/quiz-drafter.js` | Flue agent that drafts cited questions on Workers AI |
| `src/worker/cloudflare.js` | `QuizRoom` Durable Object: hibernating WebSockets, server-side timing and scoring |
| `src/worker/domain.js` | Input validation, limits and scoring |
| `src/shared/protocol.js` | Routes, error codes and WebSocket events shared by client and server |
| `src/pages/index.astro`, `src/components/` | Astro shell and React app (`/`, `/host/quiz/:id`, `/game/:code`, `/play/:code`) |
| `migrations/` | D1 schema |

Product notes are in [`PRODUCT.md`](PRODUCT.md) and the visual system is in
[`DESIGN.md`](DESIGN.md).
