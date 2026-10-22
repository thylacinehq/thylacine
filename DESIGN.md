# Design

Single page. HTML and CSS, a small shared model (`thylacine.js`) and one vanilla script (`script.js`). No libraries, no build step. Dark by default. The script turns the page into a scroll-scrubbed film; with reduced motion or no JS the page is a plain stacked document with a static drawing.

## Idea

A company page that plays like a short film. One stage stays pinned while scroll drives it. Copy lands one idea per screen. Structure taken from a reference the user pointed at (EnduroSat's space service page): pinned stage, headline swaps, a progress rail, a boxed CTA. Nothing else is borrowed.

## The mark

Five plain vertical stripes of equal height, the middle one amber. Header mark and favicon. The opening frame of the film is the same thing at full width.

## The one risk

The stripes become the animal. The film opens on a row of plain, even stripes with one amber stripe. As you scroll, each stripe slides to its own column of a thylacine silhouette and takes the span the body covers there, so the stripes gather into the animal from the tail forward. They close up into a plain coat, and the dark bands stay: 16 broad bands across the lower back, rump and tail base, one of them amber. Then it runs, and at Contact it stands.

Why it fits: the thylacine was written off as extinct in 1936. Here it is, still running. The name says it; the copy never does. No word in the copy names the animal beyond "Thylacine".

## The silhouette is generated, not traced

`thylacine.js` is a parametric skeleton:

- Body, neck and head are one closed Catmull-Rom outline.
- Ears, tail and four legs are tapered capsules on joints. Legs use two-bone IK from hip or shoulder to ankle, with raised heels.
- A gait function of phase drives a stiff trot in diagonal pairs. Running, the body drops and stretches, the legs reach, and the tail lifts in line with the spine.
- `spans()` samples the polygons column by column. `bandAt()` places the bands in body space.

Proportions were fitted by overlaying the model on the 1928 Hobart Zoo photograph (public domain, Wikimedia Commons) and checked against published measurements: shoulder height 60, head and body about 114, tail about 55, rounded upright ears, 15 to 20 bands. Reference images stayed out of the repo.

`tools/thylacine.mjs` (Node, no dependencies) uses the same model:

- `node tools/thylacine.mjs fallback` writes the static standing animal into `index.html` between the `thylacine:start` and `thylacine:end` markers.
- `node tools/thylacine.mjs preview out.svg` draws poses across the gait cycle for checking.

## Tokens

All colour is OKLCH, defined once as custom properties. The script reads the same tokens and mixes them in OKLCH.

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(0.15 0.012 65)` | fallback page below the hero |
| `--bg-deep`, `--bg-deep-clear` | `oklch(0.10 0.01 65)`, alpha 0 | stage, film page, bottom fade |
| `--sky`, `--body` | `oklch(0.30 0.06 62)`, `oklch(0.13 0.012 65)` | warm air above the ground, ground |
| `--stripe-hi`, `--stripe-lit` | `0.36`, `0.62` lightness | opening stripes, mark |
| `--fur`, `--fur-hi` | `oklch(0.58 0.06 68)`, `oklch(0.74 0.07 74)` | coat front, coat rear |
| `--band` | `oklch(0.22 0.02 55)` | dark bands |
| `--rule` | `oklch(0.30 0.015 65)` | hairlines, button border |
| `--text`, `--text-dim` | `0.95`, `0.80` lightness | headings and body, lists and nav |
| `--accent` | `oklch(0.78 0.14 72)` | eyebrows, links, the amber stripe and band, CTA |
| `--glow`, `--glow-rim` | accent hue | light behind the animal, ground line |

Measured contrast on flat tokens: text 17.00:1 on `--bg`, 17.78:1 on `--bg-deep`; dim text 10.51 and 10.99; accent 9.62 and 10.06. Measured over the rendered film (brightest pixel behind each text box, every frame, 360/768/1440): links and eyebrows 10.00:1, list items 10.70:1, rail 10.86:1, nav 10.92:1, headlines 16.68:1 or higher.

## Type

Instrument Sans 700, uppercase, tight tracking for headlines. Instrument Serif for fallback section headings. Instrument Sans 400 and 500 for body and nav. Self-hosted woff2 in `fonts/`. Fluid sizes with `clamp()`.

## Motion: scroll is the timeline

Five frames: Thylacine, Products, Clients, Projects, Contact. About 1.15 screens of scroll each. Each frame holds for the last 30% of its stretch, so a scene lands and stays.

- Thylacine: the row of stripes. Products: the stripes have become the animal, standing. Clients and Projects: it runs, and the ground marks stream past in four rows at different speeds. Contact: it slows and stands.
- The gait runs on time while the animal is running, so it keeps moving when scrolling stops; scrolling adds a push.
- The animal is sized to fit between the text and a ground line above the rail and CTA, measured from the words themselves, so nothing crosses a word.
- Spans are cached on a grid of 40 phases by 6 stride lengths. The sky is redrawn only when it changes. Device pixel ratio is capped at 2.
- Type: headings are split into words that arrive from below on a stagger; blocks lift, scale slightly and blur as they leave.
- End: the film is the last thing on the page, flush with the stage, `--bg-deep` to the last pixel, footer hidden.

With `prefers-reduced-motion: reduce`, or without JS, nothing is pinned or animated. The hero shows the standing animal drawn in stripes as static SVG, and the sections stack, ending in a small footer on the same background.

## Accessibility

Visible focus ring on every link and rail button (2px accent outline, 4px offset). Inactive frames are `inert`. Split headings keep their text in `aria-label`. Canvas, grain and the SVG animal are `aria-hidden`. One `h1`, then `h2` per section. Body links are underlined.

## Checks

Screenshots at 360, 768 and 1440 for every frame, mid-morph and across the gait cycle, plus page bottom in film and fallback. Contrast measured as above. Frame time measured in headless Chromium. Copy run through `human-voice/check.sh`.
