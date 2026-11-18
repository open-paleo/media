# Claude Code Instructions

Read [CONTRIBUTING.md](CONTRIBUTING.md) before adding an image or changing a script: it gives the
image requirements, the outline record, and the code style.

- **Never generate, draw, trace or upscale an image.** AI-generated or AI-assisted art is not
  accepted. Images come from their creators, with their license and credit recorded
- **Only CC0 1.0, CC BY 3.0 and CC BY 4.0 images.** Check the license on the source page, and
  record the creator and the source address exactly as the source gives them
- Don't edit an outline's shape; the build handles its size and colors
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
