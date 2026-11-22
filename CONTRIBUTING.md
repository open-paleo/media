# Contributing

## Image requirements

These requirements come from the Open Paleo dataset, whose images now live here.

> **AI-generated art is not accepted.** Open Paleo values the skill and
> scientific knowledge that paleo-artists bring to life reconstructions.
> AI-generated, AI-assisted, or AI-upscaled images do not meet our
> standards. Submissions suspected of using AI-generated imagery may be
> declined at the maintainers' discretion, even if not conclusively
> proven. If you are unsure whether your workflow qualifies, ask before
> submitting.

Extracted text can be checked against the paper it came from; a life reconstruction, or an
outline, is interpretive work by an artist, and there is no source to check it against. The rule
covers outlines too.

Tracing an artist's skeletal reconstruction into an outline is allowed, because it adds nothing
the artist didn't draw: `npm run trace`, with the
[outline tracer](https://github.com/open-paleo/tools/tree/main/outline-tracer), thresholds the
image, removes the rest of the figure, fills the body and fits curves to its edge with
[potrace](https://potrace.sourceforge.net), with no generative model at any step. Its settings are recorded with the outline, so anyone can rerun it
and get the same file. A traced outline is never retouched by hand, and the enlarged copy of the
image the script traces from is never published.

- **The image must be openly licensed:** your own work, which you license under CC BY 4.0 by
  submitting it, or someone else's under CC0 1.0, the Public Domain Mark, CC BY 2.0, 3.0 or 4.0,
  or CC BY-SA 3.0 or 4.0. A share-alike image's cleaned copy keeps its license. Licenses that forbid
  commercial use are not accepted, since they would set conditions on the site and on everyone
  reusing the images.
- **No watermarked or heavily manipulated images.** Specimen photos should be unmodified. Life
  reconstructions should be clearly labeled as such. A traced outline is the one change allowed
  beyond recoloring and flipping, and only as described in
  [Tracing a skeletal reconstruction](#tracing-a-skeletal-reconstruction).
- **Credit the creator.** Every image names its photographer, artist, or institution accurately,
  and links to where it came from.
- **One image per pull request,** so each can be checked on its own.

## Adding an outline

An outline shows a genus, or a typical member of a clade, drawn as one dark shape, as a side
view of the whole animal facing left. Most come from [PhyloPic](https://www.phylopic.org), whose silhouettes
list their creator and license; take only those under the licenses above.

1. Save the SVG in the folder of the name's first letter, named after the genus or clade in
   lowercase words joined by hyphens: `outlines/t/titanosauria.svg`.
2. Add a record of the same name beside it, `outlines/t/titanosauria.yml`:

   ```yaml
   taxon: Titanosauria
   title: Outline of a titanosaur
   depicts: Saltasaurus loricatus
   creator: Jane Doe
   source: https://www.phylopic.org/images/…
   license: CC-BY-3.0
   ```

| Field | What it holds |
|---|---|
| `taxon` | The genus or clade the outline stands for, spelled as the Open Paleo dataset names it. One outline per taxon. |
| `title` | The caption: "Outline of a titanosaur" for a clade's outline. |
| `depicts` | The taxon the outline was drawn from, as the source names it, so captions can say "based on…". |
| `creator` | The artist, as the source credits them. |
| `source` | The `https://` address the outline came from. |
| `license` | `CC0-1.0`, `PDM-1.0`, `CC-BY-2.0`, `CC-BY-3.0`, `CC-BY-4.0`, `CC-BY-SA-3.0` or `CC-BY-SA-4.0`. |
| `mirrored` | Optional: `true` to flip the outline horizontally in the build, when it faces right. |

A genus shows its own outline if it has one, and otherwise that of the nearest clade above it
that has one, so a broad clade's outline should look right for most of its members.

The SVG must have a `viewBox`, and may not contain scripts, event handlers, embedded images or
links to other files. The build removes its fixed size and black fills so the site can draw it in
its own colors, and flips it if the record asks; don't edit the file itself. The output notes
these changes ("Recolored; flipped horizontally"), since CC BY asks that credit lines say what
was changed.

## Tracing a skeletal reconstruction

Many genera have a skeletal reconstruction on [Wikimedia Commons](https://commons.wikimedia.org),
or in an openly licensed paper, often the one that named the genus, under an allowed license: the
artist's drawing of the bones over the body's outline, in side view. Tracing one gives a more accurate outline than most silhouettes. Pick a figure whose
body is drawn solid black behind the bones; one drawn as bones alone has no outline to trace.

Instead of saving an SVG, add the record with a `trace` block, then run `npm run trace` to write
the SVG beside it:

```yaml
taxon: Protoceratops
title: Outline of Protoceratops
depicts: Protoceratops andrewsi
creator: Scott Hartman
source: https://commons.wikimedia.org/wiki/File:Protoceratops_andrewsi_skeletal.png
license: CC-BY-4.0
trace:
  image: https://upload.wikimedia.org/wikipedia/commons/…/Protoceratops_andrewsi_skeletal.png
  sha1: 0123456789abcdef0123456789abcdef01234567
  keep_open:
    - [916, 596]
```

`source` is the file's Commons page, which names the artist and license; `creator` is the artist
it names, not the uploader.

For a figure from a paper, `source` is the paper's `https://doi.org/` address and `creator` the
artist its caption credits, or else the paper's authors. Use the publisher's own figure file as
`image` where it has one at a fixed address. Where it doesn't, for a figure only in the PDF or a
site that refuses scripted downloads, save the figure beside the record as
`outlines/t/talos.original.png` (or `.jpg`, `.tif`), give its `sha1`, and leave `image` out. The
build doesn't copy the original into `dist/`.

| Field | What it holds |
|---|---|
| `image` | The `https://` address of the full-size image file; left out when the file sits beside the record as `<name>.original.png`. |
| `sha1` | The file's SHA-1, as its Commons page gives it. The script refuses a file that doesn't match, so a later upload over the same name can't change the outline unnoticed. |
| `threshold` | Optional, 180 by default: how dark, from 0 (black) to 255 (white), a pixel must be to count as part of the drawing. Lower it if a gray background is traced; raise it if thin lines break up. |
| `keep_open` | Optional: points, in the image's own pixels, inside spaces that must stay open. Use one where overlapping legs close off the space beneath the body, which the script would otherwise fill. |
| `select` | Optional: a point, in the image's own pixels, on the animal to trace, when the figure shows several. Without it the largest is traced. |
| `erase` | Optional: rectangles to blank out before tracing, each `[left, top, right, bottom]`, such as a human figure touching the animal or a label over its tail. |
| `erase_lines` | Optional: brush strokes to blank out before tracing, each `[x1, y1, x2, y2, width]`, for dots and pointer lines along the animal where a rectangle would take part of it too. A stroke needn't be exact: where it strays over the animal's edge, the edge is kept. |
| `fill` | Optional: points inside spaces that must be filled, such as a jaw or toe whose outline opens too wide for the script to close by itself. |
| `close` | Optional: how wide a gap in the outline to close before filling, in pixels of an 800 px wide figure (0.67 by default). Raise it a little when a skull or jaw stays open; too wide closes the spaces between legs. |

Points are in the image's own pixels; for an SVG figure, in the SVG's own units. The script
renders an SVG at 2400 pixels wide to trace it, and scales the points to match.

The script takes the background color from the figure's top corners and leaves it out, so a gray
or tinted background traces like a white one; a light but clearly colored animal still counts as
drawing. It erases grid and frame lines, and ground lines but not the feet that stand on them.
It keeps the largest shape (or the one `select` points to) and anything within a few pixels of
it, such as teeth, and drops the rest: names, scale bars, human figures and smaller drawings. It
fills everything the body's outline encloses, including bones and claws drawn as white, then
removes call-outs: drawings of bones beside the animal, joined to it by thin lines. Check the
traced SVG against the figure before opening a pull request, and if something is wrong, change
the settings rather than the SVG.

The output notes what was changed: "Traced; rest of the figure removed; filled; recolored".

## Checks

```
npm ci
npm run validate      # the records and SVG files
npm run trace         # traces the outlines with a trace block; -- --check compares instead
npm run spellcheck    # the records and the docs
npm run build         # writes dist/media.json and dist/outlines/
npm run lint
npm run typecheck
```

`validate` checks that each SVG has a record and each record an SVG, that records have every field
and no others, that each file is in the folder of its first letter, that the license is one
allowed, that no taxon has two outlines, that each `trace` block is complete, and that each SVG
is safe to put in a page. Add words the spell check doesn't know, such as clade names, to
`dictionaries/words.txt`.

## Updating the outline tracer

`npm run trace` uses a pinned release of the
[outline tracer](https://github.com/open-paleo/tools/tree/main/outline-tracer). When it publishes a
release, `.github/workflows/outline-tracer-update.yml` pins it, retraces every traced outline,
and opens a pull request saying whether any of them change. If some do, run `npm run trace` on
that branch, check each changed outline against its figure, and commit them there. The workflow
uses `MEDIA_DISPATCH_TOKEN`, a fine-grained token with Contents and Pull requests: read and write
on this repository, also stored in open-paleo/tools to send the notification.

## Changing the output

`schemas/media.schema.json` describes `dist/media.json`, and its `schema_version` constant is the
version the build writes. Removing or renaming a field is a new major version; adding one is a new
minor version. Note every change in [CHANGELOG.md](CHANGELOG.md).

## Code style

The scripts in `scripts/` follow the same rules as open-paleo/data's and open-paleo/glossary's, and
ESLint enforces the formatting: Allman braces, a blank line before every `return`, verb function
names, `function` declarations, plain loops, `type` over `interface`, `Array<T>`, no `any`, no
abbreviated names, American English, multi-line JSDoc on every function, type and field, and exact
dependency versions of releases at least two weeks old.
