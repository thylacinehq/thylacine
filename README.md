# Thylacine

Software products and bespoke digital solutions.

This repo is the Thylacine company page. It is one static page of plain HTML, CSS and a small amount of vanilla JavaScript. There is no framework, no library and no build step.

## Run it

Open `index.html` in a browser. To serve the folder instead, run `python3 -m http.server` and open the address it prints.

The first screen shows straight stripes. Scroll and they gather into an animal made of bars, which walks as you scroll and stops when you stop.

## What is here

- `index.html` and `style.css` are the page.
- `script.js` pins the hero and plays it as you scroll.
- `thylacine.js` is the model that draws the animal.
- `tools/thylacine.mjs` writes the still animal used when JavaScript is off or reduced motion is set. Run `node tools/thylacine.mjs fallback` to regenerate it.
- `fonts/` holds Instrument Sans and Instrument Serif, self-hosted under the SIL Open Font License.
- `DESIGN.md` records the design decisions and the one risk the page takes.

## Notes

With reduced motion, or without JavaScript, the page is a plain stacked document with a still animal.

Frame times were measured in headless Chromium only. Phones and Safari are untested.
