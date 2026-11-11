---
name: QuizPilot
description: Source-cited live quizzes, drafted with AI and reviewed by the host.
colors:
  paper: "#f1efea"
  label: "#fbfaf8"
  ink: "#1c1b19"
  ink-hover: "#34322e"
  second-ink: "#6b6862"
  quiet: "#e7e4dd"
  hairline: "#d9d5cc"
  input-line: "#cfcac0"
  signal: "#8a1c2b"
  signal-hover: "#741624"
  pine: "#2f6b45"
  pine-wash: "#e3ece4"
  brick: "#b3261e"
  brick-wash: "#f6e3e0"
  opt-triangle: "#b0472f"
  opt-diamond: "#3a4f8a"
  opt-circle: "#b8862b"
  opt-square: "#2f6b5a"
typography:
  display:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  step:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  tag-title:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
  body:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  excerpt:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  small:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.08em"
  player-rank:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "72px"
    fontWeight: 600
    lineHeight: 1
  player-result:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 500
  player-title:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 500
  player-input:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
  button-large:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
  projector-code:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(5rem, 11vw, 11rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.04em"
    fontFeature: "'tnum'"
  projector-question:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.2vw"
    fontWeight: 500
    lineHeight: 1.15
rounded:
  base: "4px"
  chip: "999px"
spacing:
  control: "44px"
  player-option: "64px"
  top-bar: "56px"
  column: "720px"
  form-column: "480px"
  projector-column: "1200px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.label}"
    rounded: "{rounded.base}"
    height: "44px"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-signal:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.label}"
    rounded: "{rounded.base}"
    height: "44px"
  button-signal-hover:
    backgroundColor: "{colors.signal-hover}"
  button-secondary:
    backgroundColor: "{colors.quiet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    height: "44px"
  input:
    backgroundColor: "{colors.label}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    height: "44px"
  spec-tag:
    backgroundColor: "{colors.label}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
  status-chip:
    textColor: "{colors.second-ink}"
    rounded: "{rounded.chip}"
    typography: "{typography.label}"
---

# Design System: QuizPilot

## Overview

**Creative North Star: "Unbleached Label"**

Every screen is one quiet, centred label: a name, a few hairline rows of detail, one action. The world comes from no-brand packaging, with plain warm-grey stock, a single crisp grotesk, hairline spec rows, and one ink. It refuses the dashboard-with-sidebar and the Kahoot tile wall.

Content sits in one centred column. Screens shorter than the viewport are centred vertically as well. Copy is trimmed to one hint per step. The projector is the loudest surface, through scale alone: the same tag and type, sized for the back of the room.

**Key Characteristics:**
- Warm grey paper ground with near-white label surfaces.
- Solid ink primary buttons; burgundy only for live signals and the three commit moments (Start game, Publish, Join game).
- One family (Hanken Grotesk), tabular numerals, and uppercase tracked row labels.
- The spec tag (hairline `LABEL  value` rows) is the signature: sources, provenance, publish checks, the join code, and results.
- Correctness is never colour-only: a check or x icon plus a word.

## Colors

The palette is restrained: tinted neutrals plus one accent, and state colours where they mean something.

### Primary
- **Ink** (#1c1b19): text, primary buttons, and the projector's main actions.
- **Signal Burgundy** (#8a1c2b): the current step underline, selection rings, focus outlines, the timer line, the join-code rule, and the three commit buttons. Nothing decorative is burgundy.

### Neutral
- **Paper** (#f1efea): every page ground.
- **Label** (#fbfaf8): spec tags, inputs, tiles, dialogs.
- **Second Ink** (#6b6862): hints, labels, meta.
- **Quiet** (#e7e4dd): secondary button fill, the reconnect band.
- **Hairline** (#d9d5cc) and **Input Line** (#cfcac0): rules and control borders.

### State
- **Pine** (#2f6b45) with Pine Wash (#e3ece4): correct, done, live.
- **Brick** (#b3261e) with Brick Wash (#f6e3e0): wrong, errors, the last five seconds.
- **Option glyphs:** triangle #b0472f, diamond #3a4f8a, circle #b8862b, square #2f6b5a. These colour the glyph only, never a tile fill.

**The One Ink Rule.** Burgundy marks what is live or irreversible. If it isn't one of those, it isn't burgundy.

## Typography

**Font:** Hanken Grotesk Variable (self-hosted via @fontsource-variable/hanken-grotesk), one family for everything, with tabular numerals for codes, scores, counts, and timers.

### Hierarchy
- **Display** (500, 40px, -0.02em): centred page headings (Quizzes, empty states).
- **Step** (500, 32px): workspace step headings and player headings.
- **Title** (500, 20px) and **Tag title** (500, 17px).
- **Body** (400, 15px / 1.55), **Excerpt** 14px, **Small** 13px in second ink.
- **Label** (600, 11px, uppercase, 0.08em): spec-row and field labels only, never above a heading.
- **Projector:** code clamp(5rem, 11vw, 11rem) at 600; question 3.2vw at 500; options 2.2vw; leaderboard 1.8vw.

## Layout

- `Stage`: a centred column (720px default, 480px for forms and the player, 1200px for the projector) with `my-auto` inside a viewport-height flex column. Short content centres both ways; long content starts at the top and scrolls.
- Host top bar: 56px, a 720px three-part grid (wordmark, quiz title + chip, "Join a game").
- Workspace: a centred step strip (Source · Draft · Review · Publish) above a centred step heading, a one-line hint, and the step body.
- Projector: full viewport, content centred, with a 64px control bar fixed at the bottom.

## Elevation & Depth

Flat paper, with one lift. Spec tags, dialogs, and popovers use the label shadow; everything else is separated by hairlines.

- **Label shadow** (`0 1px 2px rgb(28 27 25 / 0.06), 0 8px 24px -12px rgb(28 27 25 / 0.12)`).

## Shapes

4px radius everywhere. Status chips are the only pills. Borders are 1px hairlines; the selected tile and the locked answer add a 1px inset signal ring; the correct projector tile gets a 2px pine border.

## Components

### Spec tag (signature)
A label surface with a 1px border and the label shadow. Optional header (17px title + aside), rows in a `[120px_1fr]` grid with 1px rules between them, an optional footer for actions. On mobile, rows stack.

### Buttons
- Primary: ink, 44px. Signal: burgundy, only for Start game, Publish, and Join game. Secondary: quiet fill. Ghost and outline for minor actions.
- Focus: a 2px burgundy outline offset 2px, everywhere.
- Disabled: 40% opacity.

### Inputs
Label surface, 1px input-line border, 4px radius, 44px tall. On focus, the border turns burgundy and the outline shows.

### Timer line
A 4px burgundy line across the top edge of the projector and player screens, draining to the server deadline. The seconds turn brick for the final five.

## Do's and Don'ts

### Do:
- **Do** centre every screen's column, and vertically centre short screens.
- **Do** put details in spec rows instead of sentences.
- **Do** keep one hint line per step, at most.
- **Do** use tabular numerals for every changing number.

### Don't:
- **Don't** use gradients, glass, glow, confetti, sparkle/AI icons, or eyebrow labels above headings.
- **Don't** use burgundy for decoration, or fill option tiles with their glyph colour.
- **Don't** add a sidebar; navigation is the top bar and the step strip.
- **Don't** show the correct answer on the projector while a question is open, or show client-derived time or scores.
