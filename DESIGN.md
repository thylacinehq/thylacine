# Design

Single page. HTML and CSS, a small shared model (`thylacine.js`) and one vanilla script (`script.js`). No libraries, no build step. Dark by default. The script turns the page into a scroll-scrubbed film; with reduced motion or no JS the page is a plain stacked document with a static drawing.

## Idea

A company page that plays like a short film. One stage stays pinned while scroll drives it. Copy lands one idea per screen. Structure taken from a reference the user pointed at (EnduroSat's space service page): pinned stage, headline swaps, a progress rail, a boxed CTA. Nothing else is borrowed.

## The mark

Five even vertical bars, the middle one amber: header mark and favicon. The opening frame is the same idea at full width: a row of plain, straight, evenly spaced stripes with one amber stripe among them.

## The one risk

The stripes become the animal. As you scroll, each stripe slides into a column of the animal and takes the spans the outline covers there, tail end first, so the row gathers into the body like a wave. The animal stays made of bars: every part of it, head and jaw included, is a set of vertical bars with gaps, about twice as wide as the gap, cut by a smooth outline. Then it walks. At Contact it stands and opens its jaws.

Why it fits: the thylacine was written off as extinct in 1936. Here it is, still running. The name says it; the copy never does. No word in the copy names the animal beyond "Thylacine".

## Built from bars

- One column grid for the whole animal (`layout()` in `thylacine.js`). Plain bars behind the rump and in front of the shoulder. Over the rump and tail base, 15 bands: a broad dark-topped bar and a narrow light bar each, the ninth amber, with the same bar to gap ratio as the plain bars (about 2 to 1). The forebody bars are plain and quieter.
- Over the neck the pitch narrows smoothly to 0.6 of the body pitch across the head (`HEAD_PITCH`), so the muzzle and ears keep enough bars to read at 360. The bar to gap ratio stays the same, so the neck shows no seam.
- Far legs and far ear: the same bars and paints as the near side, opaque, with a warm shade at 10% over them for depth. Measured at 1440, far legs keep about 85% of the near legs' bar to gap contrast.
- Bar edges are snapped to whole device pixels for the current scale and position, so no gap falls under one pixel and the bars stay crisp at 360. Tail, body, near legs, head, near ear and cheek: the coat, lighter toward the rump, with shade on the chest and light on the haunch, and a lighter belly.
- The lower jaw is its own group of bars. It is laid out closed, on the same grid, and turned about one hinge behind the cheek, so its bars lean as it drops. The open mouth is a dark wedge behind the bars, with a tongue on its floor. Closed, the two jaws meet on one dark mouth line.
- Detail is small solid marks on the bars: eye, brow, nose, inner ears, claws, and two or three small teeth. Teeth show only at 1440-size scales and only once the mouth is well open. Claws and brow drop out at small sizes.

## A generated silhouette

`thylacine.js` is a parametric skeleton:

- Body, head and lower jaw are closed curves. The back is highest over the hips; the belly tucks up toward the hind legs.
- The head is a long level wedge carried low, in line with the back: a nearly flat skull, a gentle stop, a long straight muzzle ending blunt in a small dark nose. Ears are medium, upright and set back. The eye is small and set high, about a third of the way back from the nose. The outline was fitted by overlay on a natural-history illustration the user supplied.
- Tail and four legs are tapered capsules on joints, the tail thick at the root. Legs are short and sturdy. The thigh is thick, the forelegs straight, and the chest sits about 35% of shoulder height off the ground. Two-bone IK: the front elbow sits a little back, so the forearm angles forward to a visible wrist and the leg straightens at full reach and folds as it tucks; the hind knee forward to a raised hock on a long foot. Paws are broad: a heel pad, an instep and four short toes, with claws as small marks at larger sizes.
- A gait function of phase drives a trot in diagonal pairs. Running, the body drops and stretches, the head bobs, the legs reach, and the tail lifts toward level.
- `pose(phase, stride, gape)` takes gape from 0 to 1. Full gape is `GAPE_DEG`, 55, set by eye. The often-quoted figure is 120 degrees. The Wikipedia article gives up to 80, citing two papers. At 80 the jaw bars turn nearly flat and the jaw hangs like a plank. At 55 the mouth is still a long open triangle.
- `spans()` samples the polygons column by column for the morph.

Reference images stayed out of the repo.

`tools/thylacine.mjs` (Node, no dependencies) uses the same model:

- `node tools/thylacine.mjs fallback` writes the static standing animal into `index.html` between the `thylacine:start` and `thylacine:end` markers.
- `node tools/thylacine.mjs preview out.svg` draws poses across the gait cycle and the gape for checking.

## Tokens

All colour is OKLCH, defined once as custom properties. The script reads the same tokens and mixes them in OKLCH.

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(0.15 0.012 65)` | fallback page below the hero |
| `--bg-deep`, `--bg-deep-clear` | `oklch(0.10 0.01 65)`, alpha 0 | stage, film page, bottom fade |
| `--sky`, `--body` | `oklch(0.30 0.06 62)`, `oklch(0.13 0.012 65)` | warm air above the ground, ground |
| `--stripe`, `--stripe-hi`, `--stripe-lit` | `0.27`, `0.36`, `0.62` lightness | opening stripes, mark |
| `--fur`, `--fur-hi`, `--fur-light` | `0.58`, `0.74`, `0.80` lightness | coat front, coat rear, light band bars |
| `--fur-shade` | `oklch(0.40 0.08 55)` | laid at 10% over the far legs and far ear |
| `--belly` | `oklch(0.84 0.05 82)` | lighter underside |
| `--band`, `--eye` | `0.22`, `0.14` lightness | dark band tops, inner ears, lines; eye and nose |
| `--mouth`, `--tongue`, `--tooth` | `0.24`, `0.46`, `0.92` lightness | the open mouth |
| `--rule` | `oklch(0.30 0.015 65)` | hairlines, button border |
| `--text`, `--text-dim` | `0.95`, `0.80` lightness | headings and body, lists and nav |
| `--accent` | `oklch(0.78 0.14 72)` | eyebrows, links, the amber stripe and bar, CTA |
| `--glow`, `--glow-rim` | accent hue | glow on the ground, ground line |

Measured contrast on flat tokens: text 17.00:1 on `--bg`, 17.78:1 on `--bg-deep`; dim text 10.51 and 10.99; accent 9.62 and 10.06. Measured over the rendered film (brightest pixel behind each text box, every frame, 360/768/1440): links and eyebrows 10.00:1, rail 10.17:1, list items 10.70:1, nav 10.92:1, CTA 15.70:1, the opening headline 16.68:1, everything else 17.66:1 or higher.

## Type

Instrument Sans 700, uppercase, tight tracking for headlines. Instrument Serif for fallback section headings. Instrument Sans 400 and 500 for body and nav. Self-hosted woff2 in `fonts/`. Fluid sizes with `clamp()`.

## Motion

Five frames: Thylacine, Products, Clients, Projects, Contact. About 1.15 screens of scroll each. Each frame holds for the last 30% of its stretch, so a scene lands and stays.

- Thylacine: the row of stripes. Products: the stripes have become the animal, standing. Clients and Projects: it walks. Contact: it stops, stands, and slowly opens its jaws.
- The gait is scrubbed by scroll, like video. Phase comes from scroll distance (one stride per 0.34 of the viewport height, weighted by how hard it runs there), eased with the same lerp as the scenes and capped at 0.45 of a stride per frame so fast flicks never strobe backward. Scroll back and it walks backward. Stop and it stops. The ground marks move exactly as far as a planted paw slides, so the feet stay put on them.
- The gape follows scroll too: it opens over the last fifth of the final stretch, eased slowly, and closes if you scroll back.
- The animal is sized to fit between the text and a ground line above the rail and CTA, measured from the words themselves, so nothing crosses a word. The dark scrim behind the rail starts at that ground line, so it never dims the legs.
- Poses (spans, outline paths) are cached on a grid of 48 phases by 6 stride lengths, plus 25 gape steps standing. Running poses are built in idle time after load. The sky is redrawn only when it changes. During the morph, a stripe that has landed copies its column from one cached render of the standing animal, so no frame clips the full outline per stripe. Detail scales with size: teeth from 3.2 px per model unit, brow from 2.4, claws from 2.2. Device pixel ratio is capped at 2.
- Type: headings are split into words that arrive from below on a stagger; blocks lift, scale slightly and blur as they leave.
- End: the film is the last thing on the page, flush with the stage, `--bg-deep` to the last pixel, footer hidden.

With `prefers-reduced-motion: reduce`, or without JS, nothing is pinned or animated. The hero shows the standing animal, mouth closed, as static SVG, and the sections stack, ending in a small footer on the same background.

## Accessibility

Visible focus ring on every link and rail button (2px accent outline, 4px offset). Inactive frames are `inert`. Split headings keep their text in `aria-label`. Canvas, grain and the SVG animal are `aria-hidden`. One `h1`, then `h2` per section. Body links are underlined.

## Checks

Screenshots at 360, 768 and 1440 for every frame, mid-morph and across the gait cycle, plus page bottom in film and fallback. Contrast measured as above. Frame time measured in headless Chromium. Copy run through `human-voice/check.sh`.
