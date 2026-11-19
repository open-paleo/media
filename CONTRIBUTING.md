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

- **The image must be openly licensed:** your own work, which you license under CC BY 4.0 by
  submitting it, or someone else's under CC0 1.0, the Public Domain Mark, CC BY 3.0 or 4.0, or
  CC BY-SA 3.0 or 4.0. A share-alike image's cleaned copy keeps its license. Licenses that forbid
  commercial use are not accepted, since they would set conditions on the site and on everyone
  reusing the images.
- **No watermarked or heavily manipulated images.** Specimen photos should be unmodified. Life
  reconstructions should be clearly labeled as such.
- **Credit the creator.** Every image names its photographer, artist, or institution accurately,
  and links to where it came from.
- **One image per pull request,** so each can be checked on its own.

## Adding an outline

An outline shows a typical member of a clade, drawn as one dark shape, as a side view of the
whole animal facing left. Most come from [PhyloPic](https://www.phylopic.org), whose silhouettes
list their creator and license; take only those under the licenses above.

1. Save the SVG as `outlines/<clade>.svg`, named after the clade in lowercase words joined by
   hyphens: `outlines/titanosauria.svg`.
2. Add `outlines/<clade>.yml` beside it:

   ```yaml
   clade: Titanosauria
   title: Outline of a titanosaur
   depicts: Saltasaurus loricatus
   creator: Jane Doe
   source: https://www.phylopic.org/images/…
   license: CC-BY-3.0
   ```

| Field | What it holds |
|---|---|
| `clade` | The clade the outline stands for, spelled as the Open Paleo dataset names it. One outline per clade. |
| `title` | The caption, saying what the outline shows: "Outline of a titanosaur", not the name of one genus. |
| `depicts` | The taxon the outline was drawn from, as the source names it, so captions can say "based on…". |
| `creator` | The artist, as the source credits them. |
| `source` | The `https://` address the outline came from. |
| `license` | `CC0-1.0`, `PDM-1.0`, `CC-BY-3.0`, `CC-BY-4.0`, `CC-BY-SA-3.0` or `CC-BY-SA-4.0`. |
| `mirrored` | Optional: `true` to flip the outline horizontally in the build, when it faces right. |

Pick the clade that the outline fits: a genus takes the outline of the nearest clade above it
that has one, so a broad clade's outline should look right for most of its members.

The SVG must have a `viewBox`, and may not contain scripts, event handlers, embedded images or
links to other files. The build removes its fixed size and black fills so the site can draw it in
its own colors, and flips it if the record asks; don't edit the file itself. The output notes
these changes ("Recolored; flipped horizontally"), since CC BY asks that credit lines say what
was changed.

## Checks

```
npm ci
npm run validate      # the records and SVG files
npm run spellcheck    # the records and the docs
npm run build         # writes dist/media.json and dist/outlines/
npm run lint
npm run typecheck
```

`validate` checks that each SVG has a record and each record an SVG, that records have every field
and no others, that the license is one allowed, that no clade has two outlines, and that each SVG
is safe to put in a page. Add words the spell check doesn't know, such as clade names, to
`dictionaries/words.txt`.

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
