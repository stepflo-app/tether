# Stepflo Accessibility Rubric

Accessibility is part of Stepflo's identity, not a checkbox. This rubric defines
the bar we hold ourselves to — higher than industry default, and applied to every
shipped surface.

## Why this is here

Most products score themselves against WCAG 2.2 AA. That is a legal floor, not a
design identity. Stepflo's commitment is that the less-accessible mode is the
opt-out, not the default — meaning power-user density is something you turn on,
not something accessibility users have to fight off.

We design for everyone, including users with cognitive, motor, visual, auditory,
and neurodivergent differences. The rubric below operationalizes that
commitment so it survives deadline pressure.

## Precedence: accessibility outranks brand and design

When this rubric and an existing Stepflo design reference disagree,
**accessibility wins**. This is the explicit, non-negotiable precedence:

1. **Accessibility rubric** (this document) — the bar.
2. **Mode identity contract** ([`mode-identity.md`](./mode-identity.md)) — how
   Find / Fix / Ship stay distinct under that bar.
3. **Stepflo design references** (palette, type, iconography, motion, voice) —
   the aesthetic execution within the bar.

Concretely: if a brand color does not hit 7:1 against its background, the
brand color changes — not the contrast target. If a beloved icon is not
distinguishable in grayscale at 16px, the icon changes — not the
"never color-alone" rule. If a marketing animation cannot respect
`prefers-reduced-motion`, the animation changes — not the motion rule.

This precedence is the whole reason the rubric exists. Without it, every
criterion below collapses the first time a stakeholder pushes back on
aesthetic grounds.

## The twelve criteria

Each criterion is binary (pass / fail) and verified on every release. A surface
that fails any criterion does not ship to general availability.

### 1. WCAG 2.2 AAA contrast

- Body text contrast ratio ≥ 7:1 against its background.
- Large text (≥ 18pt or ≥ 14pt bold) contrast ratio ≥ 4.5:1.
- Non-text UI (icons, focus rings, form borders) contrast ratio ≥ 3:1.
- Verified by automated check in CI on every PR.

### 2. Never color-alone

Every state distinction (mode, status, error, success, selection, validity)
must be carried on at least two of: color, icon, label, position, motion.

- Verified by a CI step that desaturates screenshots to grayscale and runs the
  visual diff. If two states look identical in grayscale, the build fails.

### 3. Touch targets ≥ 48×48 CSS px

- Minimum 48×48 px hit area for any interactive element.
- Minimum 8 px spacing between adjacent targets.
- Exceeds WCAG 2.2 AAA (44×44) intentionally — motor accessibility matters
  more than dense layouts.

### 4. Keyboard-complete in one pass

- Every action reachable via keyboard alone, in a logical tab order.
- Visible focus indicator with ≥ 3:1 contrast against adjacent colors.
- No keyboard traps, including in modals, menus, and embedded iframes.
- Visible "skip to main content" link as the first focusable element.

### 5. Screen reader tested on three platforms

- Tested per release against NVDA (Windows), VoiceOver (macOS + iOS), and
  TalkBack (Android).
- "axe-clean" is necessary but not sufficient — actual screen reader output
  must be reviewed for clarity, not just for the absence of errors.

### 6. Cognitive load budget per screen

- One primary action per screen, visually unmistakable.
- ≤ 5 secondary actions visible at once. Overflow goes behind a labeled menu.
- Reading level ≤ 8th grade (US), verified by Hemingway or `textstat` in CI.
- Plain language: jargon and idioms flagged in copy review.

### 7. Motion respects `prefers-reduced-motion`

- All non-essential animation disabled when the user has set
  `prefers-reduced-motion: reduce`.
- Essential animation (loading indicators, progress) degrades to a static
  equivalent — never removed entirely without a substitute.
- No exceptions. Marketing motion follows the same rule as product motion.

### 8. Generous undo windows

- Every destructive or committing action exposes an undo affordance for at
  least 30 seconds (longer for high-stakes actions like Ship).
- Undo is keyboard-reachable and screen-reader-announced.
- This is one of the highest-leverage cognitive accessibility wins — it
  serves users with Down syndrome, TBI, dementia, ADHD, and anyone working
  while tired or distracted.

### 9. Predictable layout grid

- The same kind of element lives in the same spatial slot across modes and
  screens. Mode chip, primary action, secondary actions, and status bar all
  occupy fixed positions.
- We do not reflow on hover, focus, or selection.
- Spatial memory is an accessibility feature.

### 10. Dyslexia-friendly font option

- A toggle in user settings switches the entire UI to Atkinson Hyperlegible
  (or equivalent), without breaking layout or icons.
- Persists across sessions, devices, and clients (web, mobile).

### 11. Zoom to 400% without horizontal scroll

- WCAG 2.2 AAA reflow: at 400% browser zoom on a 1280×1024 viewport, content
  reflows to a single column with no horizontal scroll.
- Verified manually per release.

### 12. Plain-language mode toggle

- A global "plain language" toggle strips product jargon and replaces it with
  literal verbs. ("Initiate workflow execution" → "Start the job.")
- Maintained as a translation layer in copy, not as a separate UI.
- This is the criterion most products skip and the one most transformative for
  cognitive accessibility.

## Defaults are inverted

Stepflo's defaults are the more accessible setting in every pair:

| Setting | Stepflo default | Power-user opt-out |
|---|---|---|
| Contrast | AAA (high) | AA (standard) |
| Motion | reduced | full |
| Density | comfortable | compact |
| Language | plain | technical |
| Sound cues | on | off |
| Undo window | 30s | 5s |

This is the single most important architectural decision in this rubric. The
defaults are the message.

## Scoring and reporting

- Every surface is scored 0–12 per release.
- Surfaces scoring below 12 do not ship to GA. They can ship behind a beta
  flag for testing, with the gap documented.
- Aggregate score is published on an internal dashboard and reviewed quarterly.
- External accessibility statement (`/accessibility`) reports the current
  aggregate score and known gaps. We publish failures, not just successes.

## Out of scope (for now)

These matter and we will get to them, but they are not part of the v1 rubric:

- Sign language interpretation for video content.
- Real-time captioning for live events.
- Braille display certification.
- WCAG 2.2 AAA criteria not listed above (e.g., 3.3.5 Context-Sensitive Help)
  — tracked separately as stretch goals.
