import * as fs from "node:fs";
import * as path from "node:path";

import { readMediaSource, rootDirectory } from "./media-source.ts";

// Builds dist/media.json and the cleaned outlines in dist/outlines/, and copies the schema they
// follow beside them.

/**
 * The output's metadata.
 */
type Metadata = {
    /**
     * The version of schemas/media.schema.json the output follows.
     */
    schema_version: string;

    /**
     * How the images are licensed.
     */
    license: string;

    /**
     * How many outlines there are.
     */
    outline_count: number;
};

/**
 * An outline in the output.
 */
type OutlineOutput = {
    /**
     * The cleaned SVG file, relative to dist/.
     */
    file: string;

    /**
     * What the outline shows, for its caption.
     */
    title: string;

    /**
     * The taxon the outline was drawn from.
     */
    depicts: string;

    /**
     * How the cleaned file differs from the original, for credit lines that must say so.
     */
    changes: string;

    /**
     * Who drew it.
     */
    creator: string;

    /**
     * Where it came from.
     */
    source: string;

    /**
     * Its license, as an SPDX id.
     */
    license: string;
};

/**
 * The whole output.
 */
type MediaOutput = {
    /**
     * The output's metadata.
     */
    _metadata: Metadata;

    /**
     * The outlines, by the clade each stands for.
     */
    outlines: Record<string, OutlineOutput>;
};

const schemaPath = path.join(rootDirectory, "schemas", "media.schema.json");
const distDirectory = path.join(rootDirectory, "dist");

/**
 * Read the schema version the schema file declares for its output.
 *
 * @returns The version.
 */
function readSchemaVersion(): string
{
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

    return schema.$defs.Metadata.properties.schema_version.const;
}

/**
 * Flip an outline horizontally within its viewBox, wrapping its contents in a mirroring group.
 *
 * @param svg - The cleaned SVG.
 * @returns The flipped SVG.
 */
function mirrorSvg(svg: string): string
{
    const viewBox = /viewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\s*["']/.exec(svg);

    if (!viewBox)
    {
        return svg;
    }

    const offset = 2 * Number(viewBox[1]) + Number(viewBox[3]);
    const rootEnd = svg.indexOf(">", svg.search(/<svg\b/i)) + 1;
    const closing = svg.lastIndexOf("</svg>");

    return svg.slice(0, rootEnd) + "<g transform=\"matrix(-1 0 0 1 " + offset + " 0)\">" + svg.slice(rootEnd, closing) + "</g>" + svg.slice(closing);
}

/**
 * Clean an outline for use in a page: drop the XML prolog, comments, metadata and fixed size,
 * and draw it in the page's text color rather than black, so it follows the site's theme.
 *
 * @param svg - The SVG file's text.
 * @returns The cleaned SVG.
 */
function cleanSvg(svg: string): string
{
    let cleaned = svg
        .replace(/<\?xml[^>]*\?>/g, "")
        .replace(/<!DOCTYPE[^>]*>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
        .replace(/<title[\s\S]*?<\/title>/gi, "")
        .replace(/\sfill\s*=\s*["'](?:#0{3}|#0{6}|black)["']/gi, "")
        .replace(/fill\s*:\s*(?:#0{3}|#0{6}|black)\s*;?/gi, "");

    cleaned = cleaned.replace(/<svg\b([^>]*)>/i, (rootTag: string, attributes: string) =>
    {
        const kept = attributes.replace(/\s(?:width|height|fill)\s*=\s*["'][^"']*["']/gi, "");

        return "<svg" + kept + " fill=\"currentColor\">";
    });

    return cleaned.trim() + "\n";
}

const source = readMediaSource();

if (source.problems.length > 0)
{
    for (const problem of source.problems)
    {
        console.error(problem);
    }

    console.error("Not built: " + source.problems.length + " problems");
    process.exit(1);
}

const outlines: Record<string, OutlineOutput> = {};

fs.rmSync(path.join(distDirectory, "outlines"), { recursive: true, force: true });
fs.mkdirSync(path.join(distDirectory, "outlines"), { recursive: true });

for (const outline of source.outlines)
{
    const file = "outlines/" + outline.id + ".svg";

    const cleaned = cleanSvg(outline.svg);

    fs.writeFileSync(path.join(distDirectory, file), outline.isMirrored ? mirrorSvg(cleaned) : cleaned);
    outlines[outline.clade] = {
        file,
        title: outline.title,
        depicts: outline.depicts,
        changes: outline.isMirrored ? "Recolored; flipped horizontally" : "Recolored",
        creator: outline.creator,
        source: outline.source,
        license: outline.license,
    };
}

const media: MediaOutput = {
    _metadata: {
        schema_version: readSchemaVersion(),
        license: "Each image keeps the license in its record; everything else is CC-BY-4.0",
        outline_count: source.outlines.length,
    },
    outlines,
};

fs.writeFileSync(path.join(distDirectory, "media.json"), JSON.stringify(media, null, 2) + "\n");
fs.copyFileSync(schemaPath, path.join(distDirectory, "media.schema.json"));
console.log("Built dist/media.json: " + source.outlines.length + " outlines");
