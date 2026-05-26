# Find / Fix / Ship — Mode Identity

Stepflo's three modes — **Find**, **Fix**, **Ship** — must be unmistakable to
every user, through every sensory and cognitive channel. Right now they blend.
This document defines the identity layers that pull them apart.

## Three rules behind everything below

1. **Color is the last channel, not the first.** Strip color and the modes are
   still unmistakable. We verify this with a grayscale CI pass — see
   `rubric.md` criterion 2.
2. **Verbs do the work in copy.** Find mode prompts use *find / discover /
   look for*. Fix mode uses *fix / update / repair*. Ship mode uses *ship /
   send / release*. The vocabulary itself reinforces mode without the user
   reading the chip.
3. **Mode is announced, not inferred.** Screen readers hear the mode at every
   transition. Sighted users see a persistent mode chip in the same spatial
   slot, every screen, every time.

## Identity matrix

| Layer | **Find** | **Fix** | **Ship** |
|---|---|---|---|
| Intent verb | discover, explore | repair, change | commit, release |
| Hue family | calm cool blue | active warm amber | confirming green |
| Foreground (AAA) | `#003E7E` | `#7A4E00` | `#00543E` |
| Background (AAA) | `#F5F9FF` | `#FFF8E8` | `#EFFBF4` |
| Accent (≥ 3:1 on bg) | `#1357B8` | `#B07300` | `#1A7A5C` |
| Icon (literal) | magnifier | wrench | paper plane |
| Shape language | rounded, open | angular, focused | diamond, forward-leaning |
| Layout posture | wide scan, list-heavy | single artifact, centered | summary card, vertical flow |
| Copy register | "What are we looking for?" | "What needs changing?" | "Ready to send this out?" |
| Sound cue (on by default) | rising soft ping | mid-tone tap | resolved chord |
| Haptic (mobile) | single light | double medium | triple firm |
| Keyboard mode key | `F` | `X` | `S` |
| ARIA landmark label | "Find mode, main" | "Fix mode, main" | "Ship mode, main" |
| Persistent status chip | "MODE: FIND" | "MODE: FIX" | "MODE: SHIP" |

All foreground/background pairs above are tested at ≥ 7:1 contrast ratio. The
accent color is for non-text UI (borders, icons, focus rings) and is held to
≥ 3:1 against the background.

## Layout posture explained

The modes differ structurally, not just chromatically.

### Find — wide scan, list-heavy

Find is exploratory. The user does not yet know what they are looking for.
Layout favors breadth: a wide content area, multi-column results, persistent
filters on the left, keyword in the top slot. Whitespace is generous so the
eye can scan. No single artifact is privileged.

### Fix — single artifact, centered

Fix is focused work on one thing. Layout favors depth: a single artifact
centered, with surrounding affordances pulled in. Filters and lists from Find
collapse into a sidebar. The artifact gets the screen. Whitespace tightens to
keep the artifact and its controls in one field of view.

### Ship — summary card, vertical flow

Ship is confirmation. The user is reviewing what they are about to commit to.
Layout favors clarity and finality: a summary card centered, vertical flow,
prominent primary action at the bottom, undo affordance visible, no
distractions in the periphery.

## Mode transitions

When the user switches modes, three things happen in a coordinated 200ms
animation (or instant, with `prefers-reduced-motion`):

1. The mode chip in the status bar swaps text and color.
2. The screen reader announces the new mode landmark.
3. The optional sound cue plays once.

The layout transition itself uses a crossfade, not a slide — slides imply
direction (forward/back) which is wrong for mode switches. Mode switches are
context shifts, not navigation steps.

## Defaults

- Mode is announced visually, audibly (if sound is on), and via screen reader.
- Sound is **on** by default. The opt-out is in user settings.
- Haptics are **on** by default on mobile.
- The persistent mode chip is **always visible**, never hidden behind a menu
  or only shown on hover.

## Accessibility-specific behaviors per mode

### Find

- Filters are keyboard-reachable via a single skip link ("Skip to filters").
- Search input is the first focusable element after the skip links.
- Result count is announced via `aria-live="polite"` on each query change.
- Empty state offers literal next actions ("Try a shorter word", "Clear all
  filters"), not abstract encouragement.

### Fix

- The focused artifact has `role="main"` and an `aria-label` describing the
  artifact ("Fixing: Customer email draft for Acme Corp").
- Edit actions are grouped under a single landmark with keyboard shortcuts
  visible inline.
- Autosave triggers an `aria-live="polite"` announcement ("Saved 2 seconds
  ago") — never silent.
- Undo is always one keypress away (`Cmd/Ctrl+Z`) and announced.

### Ship

- The primary "Ship" action requires a deliberate confirmation step. We do
  not double-click-to-ship; we two-step it.
- Confirmation step uses literal language ("Send this email to 47 people?
  This will happen immediately."), never abstract ("Confirm?").
- Undo window is 60 seconds minimum (longer than the 30s baseline in the
  rubric, because Ship is the highest-stakes mode).
- Post-ship state announces success and surfaces the undo affordance in the
  same spatial slot the Ship button occupied — so the user's eye doesn't
  have to hunt.

## What this is not

This document does not prescribe pixel-level component design — it prescribes
the **identity layers** that any component built for these modes must honor.
Component-level specs live in the design system; this document is the contract
between modes and components.
