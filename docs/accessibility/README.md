# Stepflo accessibility

Accessibility is part of Stepflo's identity. The defaults are the more
accessible setting; the power-user density is the opt-out.

## Documents

- [`rubric.md`](./rubric.md) — the 12-criterion bar we hold every surface to,
  why each criterion exists, and how it is verified.
- [`mode-identity.md`](./mode-identity.md) — how Find, Fix, and Ship are made
  unmistakable through every sensory and cognitive channel, not just color.
- [`tokens/mode-tokens.css`](./tokens/mode-tokens.css) — drop-in CSS custom
  properties for the three modes. Swap `data-mode` on the root to retheme.
- [`tokens/mode-tokens.json`](./tokens/mode-tokens.json) — the same tokens in
  W3C Design Tokens format, for Figma / Style Dictionary / Tailwind plugins.

## Status

This is a planning bundle. The token files and identity contract are intended
to be wired into the Stepflo app repo. This `tether` library does not ship UI
and is not affected by these documents directly.

## Why this exists

Built for everyone, including users with cognitive, motor, visual, auditory,
and neurodivergent differences. The rubric makes that survive deadline
pressure; the mode identity makes Find / Fix / Ship unmistakable to every
user, through every channel.
