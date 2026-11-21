# Claude Code Instructions

Read [CONTRIBUTING.md](CONTRIBUTING.md) before adding an image or changing a script: it gives the
image requirements, the outline record, and the code style.

- **Never generate, draw or upscale an image, or retouch one by hand.** AI-generated or
  AI-assisted art is not accepted. Images come from their creators, with their license and
  credit recorded. The one exception is tracing a skeletal reconstruction with
  `scripts/trace.ts` and the settings in the outline's `trace` block, as CONTRIBUTING.md
  describes; never edit a traced SVG, change its settings instead
- **Only CC0 1.0, the Public Domain Mark, CC BY 2.0, 3.0 or 4.0 and CC BY-SA 3.0 or 4.0 images;**
  never non-commercial ones. Check the license on the source page, and record the creator and the
  source address exactly as the source gives them
- Don't edit an outline's file; the build handles its size and colors, and flips it when the
  record sets `mirrored: true`
- Run `npm run validate`, `npm run spellcheck`, `npm run build`, `npm run lint` and
  `npm run typecheck` before considering a change complete
- A change to `schemas/media.schema.json` changes the output contract that open-paleo/web reads:
  bump `schema_version` (major for breaking changes) and add a CHANGELOG entry

## Git workflow

**Do not commit or push unless explicitly told to.** Show the changes and wait for the user to
say to commit or push.

## Generated output

The build writes `dist/`, which only CI commits. Working files go in `scratch/`, which is never
committed; anything there worth keeping belongs in a GitHub issue.
