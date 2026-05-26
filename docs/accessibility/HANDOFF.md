# Handoff to local implementation

This branch is the **opinionated scaffold** for Stepflo accessibility and the
Find / Fix / Ship mode identity. It is not the source of truth on aesthetics —
Stepflo's local design and technical references are. This doc names the split
so the handoff doesn't stall on "which doc wins?"

## Precedence

When the rubric here disagrees with a local reference, **accessibility wins**.
This is restated explicitly in [`rubric.md`](./rubric.md). Operationally:

| If they disagree on... | The winner is... |
|---|---|
| Contrast ratio | the rubric (AAA minimums) |
| Color-alone signaling | the rubric (never color-alone) |
| Touch target size | the rubric (≥ 48px) |
| Reduced-motion behavior | the rubric (must degrade) |
| Reading level / jargon | the rubric (≤ 8th grade, plain-language toggle) |
| Undo windows | the rubric (≥ 30s, ≥ 60s for Ship) |
| Default settings | the rubric (more accessible default) |
| Exact hex / brand palette | local design ref, *adjusted to pass the rubric* |
| Icon family and style | local design ref, *adjusted to stay distinguishable in grayscale* |
| Type stack and scale | local design ref, *with Atkinson Hyperlegible available as a user toggle* |
| Motion timing curves | local design ref, *with `prefers-reduced-motion` honored* |
| Copy voice | local design ref, *with plain-language toggle layered on top* |
| Component shapes and spacing | local design ref |
| Layout grid specifics | local design ref, posture principles from [`mode-identity.md`](./mode-identity.md) |

The pattern is consistent: **local refs choose how things look; this rubric
chooses what they cannot fall below.**

## What is authoritative here

- The **12 criteria** in [`rubric.md`](./rubric.md). Treat these as binary
  gates, not aspirations.
- The **inverted defaults** table. Accessibility is the default; density is
  the opt-out.
- The **mode identity principle** in [`mode-identity.md`](./mode-identity.md):
  Find / Fix / Ship are distinguished on color **plus** icon **plus** label
  **plus** position **plus** motion. Strip color and they are still
  unmistakable.
- The **verification approach**: grayscale CI diff, automated contrast check,
  reading-level check, three-screen-reader release test.

## What should come from local references

- Actual hex values for Find / Fix / Ship (adjust the values in
  `tokens/mode-tokens.css` and `tokens/mode-tokens.json` to Stepflo's real
  palette — but verify each pair still hits 7:1).
- Real icon names from Stepflo's icon library (replace `magnifier`, `wrench`,
  `paper-plane` placeholders).
- Real sound and haptic spec if local audio refs exist; otherwise omit those
  tokens until designed.
- Type stack, spacing scale, and motion timing.
- Wireframes and component compositions.
- Brand voice for copy (then layered with the plain-language toggle).

## Pre-handoff checklist

Before Cowork picks this up, pin which local reference is authoritative for
each layer below. Otherwise the first hour gets spent arguing precedence
within the design refs themselves:

- [ ] Palette source of truth: ________________
- [ ] Iconography source of truth: ________________
- [ ] Type source of truth: ________________
- [ ] Motion source of truth: ________________
- [ ] Copy voice source of truth: ________________
- [ ] Component library source of truth: ________________

Once those are pinned, the work order is:

1. Adjust the tokens in `tokens/mode-tokens.*` to local palette and icons,
   re-verifying contrast at each step.
2. Wire the tokens into the Stepflo app's component library.
3. Implement the CI verification steps the rubric calls for (contrast,
   grayscale visual diff, reading-level).
4. Schedule the three-screen-reader release test cadence.
5. Ship the plain-language toggle and dyslexia-friendly font toggle as
   first-class user settings.

## What this branch will *not* try to do

- Pick the final palette. The rubric sets the contrast floor; the palette
  picks itself from Stepflo's brand within that floor.
- Specify pixel-level component design.
- Replace the Stepflo design system.

If any of those need to happen, they happen in the Stepflo app repo against
local references — with this rubric as the gate, not the design.
