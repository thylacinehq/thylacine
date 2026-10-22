# Design

Single static page. HTML and CSS, no JavaScript, no build step. Dark by default.

## Idea

Quiet. The name, one mark, plain copy. The mark is the striped back: a field of vertical bars of irregular length, hanging from the top edge of the page. No animal drawing anywhere.

## The one risk

The stripe field is large, not small. It runs the full width of the hero at about a third of the viewport height, cropped by the top edge, and it is the only graphic on the page. Every bar is a dark umber, close to the background. One bar is amber.

Why it fits: the amber bar is the one that is still there. Nothing explains it. It is a structural fact of the page, and the favicon is the same bar set in miniature. A big abstract field reads as a pattern from a distance and as a mark up close, so it needs no illustration to carry the theme.

## Tokens

All colour is OKLCH, defined once as custom properties. Warm neutrals (hue 60 to 75), one accent.

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(0.15 0.012 65)` | page |
| `--surface` | `oklch(0.19 0.014 65)` | bar fill, quiet panels |
| `--rule` | `oklch(0.30 0.015 65)` | hairlines |
| `--text` | `oklch(0.92 0.02 78)` | body and headings |
| `--text-dim` | `oklch(0.72 0.025 70)` | secondary text |
| `--accent` | `oklch(0.78 0.14 72)` | links, the one bar |

60/30/10: near-flat warm black, low-chroma text, one amber. Contrast is measured, not judged by eye. Results are in the commit message.

## Type

Instrument Serif for the name and section headings. Instrument Sans for everything else. Both self-hosted as woff2 in `fonts/`, so the page makes no third-party requests.

Fluid sizes with `clamp()`. Display size has line-height 0.95 and tracking -0.02em. Body measure is capped at 60ch.

## Layout

Editorial split. A narrow left column holds the section label, a wide right column holds the content, separated by hairline rules. Under 48rem it collapses to one column. No card grid. The two groups under "What we build" are two rows separated by a rule.

## Motion

Bars draw down from the top once on load, 600ms, ease-out, staggered 40ms. Nothing bounces. `prefers-reduced-motion: reduce` removes it entirely.

## Accessibility

Visible focus ring on every link (2px accent outline, 4px offset). Decorative SVG is `aria-hidden`. One `h1`, then `h2` per section. Links are underlined.

## Checks

Screenshots at 360, 768 and 1440 px wide. Contrast measured for every text colour on its background. Copy run through `human-voice/check.sh`.
