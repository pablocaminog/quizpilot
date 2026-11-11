---
version: 1
slug: "src-components-app-shell-jsx"
primary_target: "src/components/app-shell.jsx"
related_targets: ["src/pages/index.astro"]
---

## Scope

All QuizPilot app views in one SPA shell: host dashboard, quiz workspace (Source, AI draft, Review, Publish), live projector (`/game/:joinCode`, host controls), player phone (`/play/:joinCode`). Mode: Operate.

## Audience and task

Team and event hosts drafting at a laptop, then projecting in a lit room. Players answer on phones. Success: source to live game in minutes; the projector is readable from the back of the room.

## Direction contract

THESIS: The category standard played straight, at Linear's craft level. QuizPilot refuses the Kahoot game-show look (neon tiles, confetti, loud gradients). It is a calm, precise tool whose one loud moment is the projector.

OWN-WORLD: shadcn New York neutral tokens on white. One action colour, a saturated blue (`oklch(0.53 0.21 262)`), used for primary actions, selection, and the live countdown. Inter Variable, self-hosted, with tabular numerals. 1px hairline borders, 8px radius, quiet shadows. Correct is green with a check icon and wrong is red with an x icon. Each of the four options carries a drawn shape (triangle, diamond, circle, square) so meaning never depends on colour.

STORY: The host sees one "Create quiz" action, picks a source, chats with the drafter, edits the proposal cards with provenance badges, and publishes once server validation passes. On the projector, the room sees the join code, then the question and a draining timer, then the correctness breakdown and leaderboard.

FIRST VIEWPORT: Host workspace. A slim top bar with the QuizPilot wordmark and the quiz title. A left step rail (Source, Draft, Review, Publish) shows each stage's status. The working pane holds the current stage. Publish sits as the primary blue button in the top-right of the Review stage and stays disabled until validation passes. Projector: a 160px+ tabular join code centred, the join URL beneath it, and the player count in large type.

FORM: category standard (canon, user-chosen). seed:0cb70fa89b50af54. Signature move: the question timer is a full-width blue bar draining across the top edge of the projector and player screens, driven by server deadlines.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
