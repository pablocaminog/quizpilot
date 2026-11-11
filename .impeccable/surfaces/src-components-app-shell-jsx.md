---
version: 1
slug: "src-components-app-shell-jsx"
primary_target: "src/components/app-shell.jsx"
related_targets: ["src/pages/index.astro"]
---

## Scope

Every QuizPilot view: dashboard, quiz workspace (Source, Draft, Review, Publish), projector (`/game/:joinCode`), player phone (`/play`, `/play/:joinCode`). Mode: Operate. Redesign: this replaces the previous shadcn-neutral look.

## Audience and task

Team and event hosts drafting at a laptop, then projecting in a lit room; players answer on phones. User asks: elegant, minimal, everything centred in the viewport (both axes on short screens), less text (one key hint per step), better colours and fonts.

## Direction contract

THESIS: Unbleached Label. Every screen is one quiet, centred label: a name, a few hairline rows of detail, one action. It refuses the dashboard-with-sidebar and the Kahoot tile wall.

OWN-WORLD: Warm grey paper ground `#f1efea`, label surfaces `#fbfaf8`, ink `#1c1b19`, second ink `#6b6862`, hairlines `#d9d5cc`. One burgundy accent `#8a1c2b` reserved for the live signal: selection, current step, the timer line, the join-code rule. Primary buttons are solid ink. Type is Hanken Grotesk Variable alone: tabular numerals, uppercase 11–12px tracked row labels. Radius is 4px; nothing is pill-shaped except status chips. Correct is pine `#2f6b45` with a check; wrong is brick `#b3261e` with an x.

STORY: The host sees one label per step, fills it in, and moves on. The room sees one big tag (the code), then one question, then the result.

FIRST VIEWPORT: The workspace is a centred 720px column under a 56px bar. A centred step strip (Source · Draft · Review · Publish), with a burgundy underline on the current step, sits above the active step's label. On short steps the column is vertically centred. On the projector lobby, the join code is centred on screen in a hairline tag with rows "Join at" and "Players".

FORM: Unbleached Label, position 7 on my ordered list (assigned). seed:7ce291b2adbe4484. Signature move: the hairline spec tag, rows of `LABEL  value` separated by 1px rules, used for sources, provenance, the join code, and results.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
