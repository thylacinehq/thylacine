# Design

Single page. HTML and CSS plus one vanilla script, no libraries, no build step. Dark by default. The script turns the page into a scroll-scrubbed film; with reduced motion or no JS the page is a plain stacked document.

## Idea

A company page that plays like a short film. One stage stays pinned while scroll drives a camera along a striped back. Copy lands one idea per screen. Structure taken from a reference the user pointed at (EnduroSat's space service page): pinned stage, headline swaps, a progress rail, a boxed CTA. Nothing else is borrowed.

## The mark

The striped back: a curved spine with thin, evenly spaced stripes hanging from it, each tapering to a point. One stripe is amber. No animal drawing anywhere. The header mark and favicon are five of these stripes under a short arc; the hero is the same thing at full scale.

Stripes are near uniform on purpose. Varying heights read as a bar chart or an equalizer, which would imply data this page does not have.

## The one risk

The whole stage is one graphic: the back, filling the lower half of the screen, with a single amber stripe that the film follows. Scenes never change stripe height. They change by camera: pan along the spine, curvature, stripe spacing, which stripes are lit, and which of three depth planes is in focus. In the Projects scene ("Nothing is listed yet.") every stripe but the amber one goes dark. In Contact the camera has reached it and the light comes up.

Why it fits: the amber stripe is the one still standing. Nothing explains it. Warm light behind the spine keeps it off the default cold space-tech palette.

## Tokens

All colour is OKLCH, defined once as custom properties. The script reads the same tokens and mixes them in OKLCH.

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(0.15 0.012 65)` | fallback page below the hero |
| `--bg-deep` | `oklch(0.10 0.01 65)` | stage, film page background |
| `--bg-deep-clear` | same, alpha 0 | bottom scrim fade |
| `--sky` | `oklch(0.30 0.06 62)` | warm air above the spine |
| `--body` | `oklch(0.13 0.012 65)` | the back under the spine |
| `--stripe`, `--stripe-hi`, `--stripe-lit` | `0.27`, `0.36`, `0.62` lightness, hue 65 to 68 | stripes unlit to lit, mark |
| `--rule` | `oklch(0.30 0.015 65)` | hairlines, button border |
| `--text` | `oklch(0.95 0.02 78)` | headings, body |
| `--text-dim` | `oklch(0.80 0.025 70)` | lists, nav, rail |
| `--accent` | `oklch(0.78 0.14 72)` | eyebrows, links, the amber stripe, CTA |
| `--glow`, `--glow-rim` | accent hue | light behind the spine, spine rim |

Measured contrast (WCAG) on flat tokens: text 17.00:1 on `--bg`, 17.78:1 on `--bg-deep`. Dim text 10.51:1 and 10.99:1. Accent 9.62:1 and 10.06:1. CTA arrow 10.06:1.

Measured over the rendered film (brightest pixel behind each text box, every frame, at 360, 768 and 1440): list items 8.52:1, links 8.89:1, eyebrows and section labels 10.00:1, rail labels 10.38:1, nav 10.92:1, headlines 12.46:1 or higher.

## Type

Instrument Sans 700, uppercase, tight tracking for headlines. Instrument Serif for fallback section headings. Instrument Sans 400 and 500 for body and nav. Self-hosted woff2 in `fonts/`. Fluid sizes with `clamp()`.

## Motion: scroll is the timeline

Five frames: Thylacine, Products, Clients, Projects, Contact. About 1.15 screens of scroll each. Each frame holds for the last 30% of its stretch, so a scene lands and stays; the displayed position eases toward the scroll position.

- Stage: three canvases (far, main, near) draw the back. Far is flatter, finer and slides slower; near is a soft shoulder at the bottom edge that moves fastest. Focus is pulled with CSS blur on the planes.
- Text safety: the spine's crest is placed below whichever frame's text is showing, measured from the words themselves. Everything bright sits below that line. A scrim at the bottom keeps the rail and CTA clear of stripes.
- Type: headings are split into words. Words arrive from below on a stagger as you scroll in; the block lifts, scales slightly and blurs as you scroll out. Between frames there is a beat where only the camera moves.
- Load: stripes draw down from the spine, 1.6 s, ease-out. Nothing bounces.
- End: the film is the last thing on the page. It ends flush with the stage, the background is `--bg-deep` to the last pixel, and the footer is hidden in film mode.

A rail at bottom left shows the five frames and doubles as navigation. The GitHub button stays on screen throughout.

With `prefers-reduced-motion: reduce`, or without JS, nothing is pinned or animated: a static SVG of the back sits under the headline and the sections stack, ending in a small footer on the same background.

## Accessibility

Visible focus ring on every link and rail button (2px accent outline, 4px offset). Inactive frames are `inert`. Split headings keep their text in `aria-label`. Canvases, grain and the SVG back are `aria-hidden`. One `h1`, then `h2` per section. Body links are underlined.

## Checks

Screenshots at 360, 768 and 1440 for every frame and mid-transition, plus page bottom in film and fallback. Contrast measured as above. Copy run through `human-voice/check.sh`.
