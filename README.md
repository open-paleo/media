# Open Paleo Media

Images for [Open Paleo](https://github.com/open-paleo): for now, outlines of dinosaur groups, a
sauropod for sauropods and a dromaeosaur for dromaeosaurids, which
[open-paleo.org](https://open-paleo.org) shows on genus pages. Specimen photos, life
reconstructions and skeletal diagrams may follow.

## Using the media

Every push to `main` builds `dist/media.json`, the cleaned outlines in `dist/outlines/`, the
JSON Schema the output follows (`dist/media.schema.json`) and TypeScript types
(`dist/bindings/media.d.ts`).

```json
{
  "_metadata": { "schema_version": "1.2.0", "license": "Each image keeps the license in its record; everything else is CC-BY-4.0", "outline_count": 1 },
  "outlines": {
    "Titanosauria": {
      "file": "outlines/t/titanosauria.svg",
      "title": "Outline of a titanosaur",
      "depicts": "Saltasaurus loricatus",
      "changes": "Recolored",
      "creator": "Jane Doe",
      "source": "https://www.phylopic.org/images/…",
      "license": "CC-BY-3.0"
    }
  }
}
```

Outlines are keyed by the genus or clade they stand for, as the Open Paleo dataset names it. A
genus shows its own outline if it has one, and otherwise that of the nearest clade above it that
has one, so an outline of a titanosaur serves every titanosaur until a more specific one is
added. A clade's outline shows a typical member, not any one genus, and captions should say so.

The cleaned SVGs are drawn in `currentColor`, with a `viewBox` and no fixed size, so a page can
size and color them; inline them rather than linking to them.

`schema_version` follows semantic versioning: a new major version is a breaking change, a new
minor version adds fields. [CHANGELOG.md](CHANGELOG.md) lists every change to the output.

## Layout

Each outline is two files in the folder of its first letter, such as `outlines/t/`: the SVG and a
YAML record of the same name, giving the genus or clade it stands for, its caption, the taxon it
was drawn from, its creator, its source and its license. Letter folders keep the folders small
however many outlines there are, and unlike folders by family tree, never need moving when a
classification changes.
[CONTRIBUTING.md](CONTRIBUTING.md) describes the record and what an image must meet.

## License

**Each image keeps the license it came with,** recorded in its YAML file: CC0 1.0, the Public
Domain Mark, CC BY 3.0 or 4.0, or CC BY-SA 3.0 or 4.0; none forbids commercial use. Anyone using
an image must credit its creator as its license requires, noting the changes the output lists;
the record gives the creator and the source. Images contributed as original work, the records, the scripts and
the docs are licensed under [CC BY 4.0](LICENSE); credit "Open Paleo contributors".

**AI-generated art is not accepted.** See [CONTRIBUTING.md](CONTRIBUTING.md#image-requirements).
