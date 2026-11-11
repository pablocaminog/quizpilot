---
name: QuizPilot
description: Source-cited live quizzes, drafted with AI and reviewed by the host.
colors:
  primary: "oklch(0.53 0.21 262)"
  primary-foreground: "oklch(0.985 0 0)"
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  border: "oklch(0.922 0 0)"
  success: "oklch(0.52 0.14 152)"
  success-muted: "oklch(0.96 0.04 152)"
  destructive: "oklch(0.577 0.245 27.325)"
  destructive-muted: "oklch(0.96 0.03 27)"
  opt-triangle: "oklch(0.58 0.2 27)"
  opt-diamond: "oklch(0.53 0.21 262)"
  opt-circle: "oklch(0.72 0.15 75)"
  opt-square: "oklch(0.55 0.13 175)"
typography:
  projector-code:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(6rem, 13vw, 14rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
    fontFeature: "'tnum'"
  projector-question:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.4vw"
    fontWeight: 600
  page-title:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  section-title:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
  body:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    fontFeature: "'cv11', 'ss01'"
  meta:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  control-height: "44px"
  player-option-height: "64px"
  top-bar: "56px"
  step-rail: "248px"
  pane: "760px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "44px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "44px"
  option-tile:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
  option-tile-correct:
    backgroundColor: "{colors.success-muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
---

# Design System: QuizPilot

## Overview

**Creative North Star: "The Quiet Control Room"**

QuizPilot uses the category standard, played straight: shadcn/ui New York neutral tokens, Inter, hairline borders, and one blue action colour. The bar is Linear's level of craft: aligned, dense where the host works, and calm. The host workspace is a quiet tool at a desk. The projector is the system's one loud moment, with type sized for the back row of a lit room.

Provenance and server authority are shown plainly. Every question carries a citation badge or an "AI-generated" badge. Timers and scores come from the room, never from the client.

**Key Characteristics:**
- Light theme everywhere (desk, lit meeting room, phones in the same room).
- One action colour; all other colour carries state or option identity.
- Correctness is never colour-only: a check or x icon and a text label always accompany it.
- 44px minimum targets; 64px player options.

## Colors

A neutral ground, one blue for action, and state colours only where they mean something.

### Primary
- **Action Blue** (oklch(0.53 0.21 262)): primary buttons, selection rings, the focus ring, current step glyph, and the draining question timer bar.

### Neutral
- **White** (oklch(1 0 0)): every background.
- **Ink** (oklch(0.145 0 0)): text.
- **Muted** (oklch(0.97 0 0)): secondary buttons, host chat bubbles, lobby alias chips, current rail row.
- **Hairline** (oklch(0.922 0 0)): all borders and dividers.

### State
- **Correct Green** (oklch(0.52 0.14 152)) with Correct Wash (oklch(0.96 0.04 152)): the correct answer, done steps, the "Live" indicator.
- **Error Red** (oklch(0.577 0.245 27.325)) with Error Wash (oklch(0.96 0.03 27)): failures, wrong answers, the last 5 seconds of a timer.

### Option identity
Triangle red, diamond blue, circle amber, square teal (`--opt-0..3`). These colour only the shape glyphs, never the tile fills.

**The One Voice Rule.** Blue means "act here" or "time is running". Nothing decorative is blue.

## Typography

**Font:** Inter Variable (self-hosted via @fontsource-variable/inter), with `cv11` and `ss01` enabled; tabular numerals for codes, scores, counts, and timers.

### Hierarchy
- **Projector code** (700, clamp(6rem, 13vw, 14rem), tracking 0.06em): the join code only.
- **Projector question** (600, 3.4vw, balanced, max 28ch); options at 2.4vw; leaderboard at 2vw.
- **Page title** (600, 22px, -0.01em); **Section title** (600, 18px).
- **Body** (400, 15px); **Body-sm** 14px; **Meta** 13px muted.

**The Back-Row Rule.** Projector type scales with the viewport (`vw`), so it reads the same on any projected screen.

## Layout

- Host top bar 56px; content max 1200px.
- The workspace has a 248px step rail (Source, Draft, Review, Publish) with a full-height hairline, and a working pane up to 760px. Below 1024px the rail becomes a horizontal strip.
- The dashboard is a max-960px single bordered list, not a card grid.
- Projector: full viewport, with an 80px control bar fixed at the bottom and one contextual primary action (Space triggers it).
- Player: max 480px, single column, safe-area padding.

## Elevation & Depth

Flat. Depth comes from hairline borders and the muted fill. Shadows are limited to the shadcn `shadow-xs` on inputs and the default dialog and popover shadows.

## Shapes

8px base radius (`--radius: 0.5rem`). Inputs and buttons use 6px, containers 8px, option tiles and player answers 12px. Borders are 1px, except a 2px selection ring and a 3px correct-tile border.

## Components

### Buttons
- **Primary:** Action Blue, white text, 44px high; at most one per area.
- **Secondary:** muted fill. **Ghost:** for navigation and dismissal.
- **Focus:** 3px ring at ring/50. **Disabled:** 50% opacity, with a tooltip explaining why when the reason isn't obvious (e.g. Publish).

### Source tiles
2×2 radiogroup; the selected tile gets a 2px primary ring and a check glyph.

### Question editor
Bordered section per question: provenance badge, move and delete toolbar, option rows with a shape glyph, input, and a fixed-width "Correct" radio that shows a check plus the word "Correct", plus a timer select and a rationale field.

### Timer bar (signature)
An 8px full-width bar at the top of the projector and player screens, draining right-to-left to the server deadline. It turns red for the final 5 seconds and updates stepwise under reduced motion.

### Option tiles (projector)
White tile with a hairline border and a shape glyph. When the question closes, the correct tile gets the Correct Wash, a 3px green border, and a "Correct answer" label; the others drop to 45% opacity. Each tile shows a pick-count bar.

## Do's and Don'ts

### Do:
- **Do** pair every correctness state with an icon and a word.
- **Do** use tabular numerals for every number that changes.
- **Do** keep stock shadcn primitives; restyle only through tokens.

### Don't:
- **Don't** use gradients, glass, glow, confetti, sparkle/AI icons, or eyebrow labels above headings.
- **Don't** fill option tiles with their identity colour (the Kahoot look).
- **Don't** show the correct answer on the projector while a question is open.
- **Don't** display client-derived time or scores.
