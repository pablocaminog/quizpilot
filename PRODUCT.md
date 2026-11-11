# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro (static, JavaScript only) with React islands and shadcn/ui (New York, JSX, `tsx: false`), Tailwind, Hono on Cloudflare Workers, Flue (`@flue/runtime`) for the drafting agent, Workers AI, D1, R2, Durable Objects, Browser Run (Kitesurf). Deployed via the Deploy to Cloudflare button into the deployer's own authenticated account. Source of truth: `QUIZPILOT_PLAN.md`.

## Users

- **Hosts:** team leads and event organizers running a quiz at a meetup, all-hands, or casual event. They prepare the quiz on a laptop beforehand, then project the live game on a shared screen.
- **Players:** attendees joining on their phones with a six-character code; no account, just an alias.

## Product Purpose

A host describes a learning goal in chat, picks a source (website URL, pasted text, a PDF or text document, or an original brief), reviews and edits the AI-drafted quiz, publishes it, and runs a real-time Kahoot-style game. Success: a host goes from a source to a projected live game in minutes, and every question is traceable to its source or explicitly marked AI-generated.

## Positioning

Every question carries provenance: exact cited excerpts from a captured source snapshot (including rendered webpages via Cloudflare Kitesurf), or an explicit `AI-generated` label. The host review is the only commit boundary; the AI never publishes or scores. Timing and scoring are server-authoritative.

## Operating Context

- Drafting happens at a desk, on a laptop.
- The live game is projected in a room: the projector view must be readable from the back (join code, countdown, question, options, leaderboard).
- Players answer on phones, often on spotty event Wi-Fi; reconnects must restore the authoritative room state.

## Capabilities and Constraints

- Sources: public unauthenticated HTTPS webpages only (no bot-protected/authenticated pages), pasted text, UTF-8 `text/plain` / `text/markdown` documents under 512 KiB, PDFs with selectable text under 10 MiB (extracted with Workers AI `toMarkdown`; scanned/image-only PDFs are rejected), or a generation brief. No Office documents.
- Quizzes: 2–20 questions, 2–4 options, one correct answer, 5–120 s timer each.
- Host identity is an opaque browser cookie; no accounts or recovery.
- Deployment requires Cloudflare authorization; never claim anonymous deployment.

## Brand Commitments

- Visual world: the category standard, played straight. Stock shadcn/ui New York neutral tokens, one high-contrast action colour, no decorative gradients, no custom component library (user choice, 2026-11-10).
- Craft bar: Linear. Dense, precise, calm app UI.

## Evidence on Hand

None. No customers, testimonials, or usage metrics exist; do not fabricate them.

## Product Principles

1. The host reviews before anything is published; AI proposes, people commit.
2. Show provenance on every question.
3. The room is the authority: no client clocks, client scores, or client-derived time on screen.
4. Readable at a distance: the projector view is designed for the back of the room.

## Accessibility & Inclusion

44px minimum touch targets, visible focus, correctness never conveyed by colour alone, projector text sized for distance reading.
