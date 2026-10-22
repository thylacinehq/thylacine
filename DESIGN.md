# Design

Single static page. HTML and CSS, no JavaScript, no build step. Dark by default.

## Idea

A company page that looks like one: header with mark, nav and a boxed Contact button, a huge bold headline, one dominant visual, a clear call to action. Layout structure taken from a reference the user pointed at (EnduroSat's space service page). Nothing else is borrowed.

The mark is the striped back: vertical bars of irregular height. No animal drawing anywhere.

## The one risk

The stripes are the hero visual, not a logo. Thirteen skewed bars rise from behind a glowing horizon arc on the right of the hero, all in dark umber, close to the background. One bar is amber, taller than the rest, and lit.

Why it fits: the amber bar is the one that is still standing. Nothing explains it. The header mark and the favicon are the same five bars in miniature, so the big image and the small mark are one idea at two scales. A warm horizon glow in place of a cold blue one keeps it off the default space-tech palette.

## Tokens

All colour is OKLCH, defined once as custom properties. Warm neutrals (hue 65 to 78), one accent.

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(0.15 0.012 65)` | page below the hero |
| `--bg-deep` | `oklch(0.10 0.01 65)` | hero, horizon |
| `--stripe`, `--stripe-hi` | `oklch(0.27 0.02 65)`, `oklch(0.36 0.03 65)` | bars, mark |
| `--rule` | `oklch(0.30 0.015 65)` | hairlines, button border |
| `--text` | `oklch(0.95 0.02 78)` | headings, body |
| `--text-dim` | `oklch(0.80 0.025 70)` | lists, nav |
| `--accent` | `oklch(0.78 0.14 72)` | eyebrow, links, the lit bar, CTA |
| `--glow`, `--glow-rim`, `--glow-bar` | accent hue at 0.35 to 0.55 alpha | horizon and lit-bar light |

Measured contrast (WCAG): text 17.00:1 on `--bg`, 17.78:1 on `--bg-deep`. Dim text 10.51:1 and 10.99:1. Accent 9.62:1 and 10.06:1. CTA arrow, `--bg-deep` on accent, 10.06:1.

## Type

Instrument Sans 700, uppercase, tight tracking for the headline and group headings. Instrument Serif for section headings. Instrument Sans 400 and 500 for body and nav. All self-hosted as woff2 in `fonts/`, so the page makes no third-party requests.

Fluid sizes with `clamp()`. Headline line-height 0.98, tracking -0.03em, capped at 13ch.

## Layout

Hero fills the first screen: header row, copy block, field and horizon, CTA bottom right. Below it, an editorial split: narrow left column for the section label, wide right column for content, separated by hairlines. Under 48rem it is one column and the nav links collapse, leaving mark and Contact. No card grid.

## Motion

Bars rise once on load, 700ms, ease-out, staggered 45ms. Nothing bounces. `prefers-reduced-motion: reduce` removes it and the smooth scroll.

## Accessibility

Visible focus ring on every link (2px accent outline, 4px offset). Decorative SVG and the bar field are `aria-hidden`. One `h1`, then `h2` per section. Body links are underlined.

## Checks

Screenshots at 360, 768 and 1440 px wide. Contrast measured for every text colour on its background. Copy run through `human-voice/check.sh`.
