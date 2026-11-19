import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { parse } from "yaml";

// Reads the outline records and their SVG files, and finds problems in them.

/**
 * An outline: an SVG file and its record, which describes it and gives its source.
 */
export type Outline = {
    /**
     * The file's path under outlines/ without its extension, such as "t/titanosauria".
     */
    id: string;

    /**
     * The genus or clade the outline stands for, as the dataset names it.
     */
    taxon: string;

    /**
     * What the outline shows, for its caption: "Outline of a titanosaur".
     */
    title: string;

    /**
     * The taxon the outline was drawn from, such as "Camarasaurus supremus".
     */
    depicts: string;

    /**
     * Whether the build flips the outline horizontally, so it faces the same way as the others.
     */
    isMirrored: boolean;

    /**
     * Who drew it.
     */
    creator: string;

    /**
     * Where it came from, such as its PhyloPic page.
     */
    source: string;

    /**
     * Its license, as an SPDX id.
     */
    license: string;

    /**
     * How the outline was traced from a skeletal reconstruction, or undefined if it wasn't.
     */
    trace: TraceSettings | undefined;

    /**
     * The SVG file's text.
     */
    svg: string;
};

/**
 * An outline's record, without its SVG file.
 */
export type OutlineRecord = Omit<Outline, "svg">;

/**
 * How an outline is traced from a skeletal reconstruction (see scripts/trace.ts).
 */
export type TraceSettings = {
    /**
     * The address of the full-size image file.
     */
    image: string;

    /**
     * The image file's SHA-1, in hex.
     */
    sha1: string;

    /**
     * How dark a pixel must be to count as part of the drawing, from 0 (black) to 255 (white).
     */
    threshold: number;

    /**
     * Points, in the image's own pixels, inside spaces that must stay open.
     */
    keepOpen: Array<[number, number]>;
};

/**
 * The outlines as their files give them, with any problems found.
 */
export type MediaSource = {
    /**
     * The outlines, in id order.
     */
    outlines: Array<Outline>;

    /**
     * Each problem found, naming the file it is in.
     */
    problems: Array<string>;
};

export const rootDirectory = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..");

const outlinesDirectory = path.join(rootDirectory, "outlines");

// The licenses an image may carry. Share-alike images are allowed: the cleaned copy keeps the
// same license. Non-commercial ones are not.
export const allowedLicenses = new Set(["CC0-1.0", "PDM-1.0", "CC-BY-3.0", "CC-BY-4.0", "CC-BY-SA-3.0", "CC-BY-SA-4.0"]);

// The fields an outline record may have, and those of its trace block.
const outlineFields = new Set(["taxon", "title", "depicts", "creator", "source", "license", "mirrored", "trace"]);
const traceFields = new Set(["image", "sha1", "threshold", "keep_open"]);

// The threshold a trace uses unless its record gives another.
export const defaultTraceThreshold = 180;

// The largest SVG file accepted, in bytes; outlines are simple shapes.
const maximumSvgBytes = 200_000;

// File names: lowercase words joined by hyphens.
const idPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Parts of an SVG that could run code, load something from elsewhere, or embed a raster image.
const unsafeSvgPatterns: Array<[RegExp, string]> = [
    [/<script\b/i, "a script"],
    [/<foreignObject\b/i, "embedded HTML"],
    [/<image\b/i, "an embedded image"],
    [/\son[a-z]+\s*=/i, "an event handler"],
    [/(?:xlink:)?href\s*=\s*["'](?!#)/i, "a link to another file"],
    [/url\(\s*["']?(?!#)/i, "a reference to another file"],
];

/**
 * Check whether a value is a non-empty string with no stray spaces.
 *
 * @param value - The value.
 * @returns Whether it is.
 */
function isCleanText(value: unknown): value is string
{
    return typeof value === "string" && value.length > 0 && value === value.trim() && !value.includes("  ");
}

/**
 * Find the problems in an SVG file: anything unsafe, a missing viewBox, or too large a file.
 *
 * @param svg - The file's text.
 * @param file - The file, for problems.
 * @param problems - Where to add problems.
 */
function checkSvg(svg: string, file: string, problems: Array<string>): void
{
    const root = /<svg\b[^>]*>/i.exec(svg);

    if (!root)
    {
        problems.push(file + ": not an SVG file");

        return;
    }

    if (!/\sviewBox\s*=/.test(root[0]))
    {
        problems.push(file + ": the <svg> element needs a viewBox, so the site can size it");
    }

    if (Buffer.byteLength(svg) > maximumSvgBytes)
    {
        problems.push(file + ": larger than " + maximumSvgBytes / 1000 + " KB; simplify the outline");
    }

    for (const [pattern, description] of unsafeSvgPatterns)
    {
        if (pattern.test(svg))
        {
            problems.push(file + ": contains " + description + ", which outlines may not");
        }
    }
}

/**
 * Check whether a value is a point: two whole numbers, zero or more.
 *
 * @param value - The value.
 * @returns Whether it is.
 */
function isPoint(value: unknown): value is [number, number]
{
    return Array.isArray(value) && value.length === 2 && Number.isInteger(value[0]) && Number.isInteger(value[1]) && value[0] >= 0 && value[1] >= 0;
}

/**
 * Read a record's trace block.
 *
 * @param value - The block.
 * @param recordFile - The record, for problems.
 * @param problems - Where to add problems.
 * @returns The settings, or undefined if the block cannot be used.
 */
function readTraceSettings(value: unknown, recordFile: string, problems: Array<string>): TraceSettings | undefined
{
    if (typeof value !== "object" || value === null || Array.isArray(value))
    {
        problems.push(recordFile + ": trace must be a mapping of fields");

        return undefined;
    }

    const fields = value as Record<string, unknown>;

    for (const field of Object.keys(fields))
    {
        if (!traceFields.has(field))
        {
            problems.push(recordFile + ": unknown trace field " + field);
        }
    }

    const keepOpen = fields.keep_open ?? [];
    const threshold = fields.threshold ?? defaultTraceThreshold;
    let isUsable = true;

    if (typeof fields.image !== "string" || !fields.image.startsWith("https://"))
    {
        problems.push(recordFile + ": trace needs the https:// address of the image file");
        isUsable = false;
    }

    if (typeof fields.sha1 !== "string" || !/^[0-9a-f]{40}$/.test(fields.sha1))
    {
        problems.push(recordFile + ": trace needs the image file's SHA-1, 40 lowercase hex digits");
        isUsable = false;
    }

    if (!Number.isInteger(threshold) || (threshold as number) < 1 || (threshold as number) > 254)
    {
        problems.push(recordFile + ": the trace threshold must be a whole number from 1 to 254");
        isUsable = false;
    }

    if (!Array.isArray(keepOpen) || !keepOpen.every(isPoint))
    {
        problems.push(recordFile + ": keep_open must be a list of points, each [x, y] in the image's pixels");
        isUsable = false;
    }

    if (!isUsable)
    {
        return undefined;
    }

    return { image: fields.image as string, sha1: fields.sha1 as string, threshold: threshold as number, keepOpen: keepOpen as Array<[number, number]> };
}

/**
 * Read one outline's record.
 *
 * @param id - The outline's path under outlines/ without its extension, such as "t/titanosauria".
 * @param problems - Where to add problems.
 * @returns The record, or undefined if it cannot be used.
 */
export function readOutlineRecord(id: string, problems: Array<string>): OutlineRecord | undefined
{
    const recordFile = "outlines/" + id + ".yml";
    let data: unknown;

    try
    {
        data = parse(fs.readFileSync(path.join(rootDirectory, recordFile), "utf8"));
    }
    catch (error)
    {
        problems.push(recordFile + ": not valid YAML: " + (error instanceof Error ? error.message.split("\n")[0] : String(error)));

        return undefined;
    }

    if (typeof data !== "object" || data === null || Array.isArray(data))
    {
        problems.push(recordFile + ": expected a mapping of fields");

        return undefined;
    }

    const fields = data as Record<string, unknown>;

    for (const field of Object.keys(fields))
    {
        if (!outlineFields.has(field))
        {
            problems.push(recordFile + ": unknown field " + field);
        }
    }

    if (!isCleanText(fields.taxon) || !isCleanText(fields.title) || !isCleanText(fields.depicts) || !isCleanText(fields.creator) || !isCleanText(fields.source) || !isCleanText(fields.license))
    {
        problems.push(recordFile + ": needs a taxon, a title, the taxon it depicts, a creator, a source and a license");

        return undefined;
    }

    if (fields.mirrored !== undefined && typeof fields.mirrored !== "boolean")
    {
        problems.push(recordFile + ": mirrored must be true or false");
    }

    if (!allowedLicenses.has(fields.license))
    {
        problems.push(recordFile + ": the license " + fields.license + " is not one of " + [...allowedLicenses].join(", "));
    }

    if (!fields.source.startsWith("https://"))
    {
        problems.push(recordFile + ": the source must be an https:// address");
    }

    const trace = fields.trace === undefined ? undefined : readTraceSettings(fields.trace, recordFile, problems);

    if (fields.trace !== undefined && !trace)
    {
        return undefined;
    }

    return {
        id,
        taxon: fields.taxon,
        title: fields.title,
        depicts: fields.depicts,
        isMirrored: fields.mirrored === true,
        creator: fields.creator,
        source: fields.source,
        license: fields.license,
        trace,
    };
}

/**
 * Read one outline's record and SVG file.
 *
 * @param id - The outline's path under outlines/ without its extension, such as "t/titanosauria".
 * @param problems - Where to add problems.
 * @returns The outline, or undefined if its files cannot be used.
 */
function readOutline(id: string, problems: Array<string>): Outline | undefined
{
    const record = readOutlineRecord(id, problems);
    const svgFile = "outlines/" + id + ".svg";

    if (!record)
    {
        return undefined;
    }

    if (!fs.existsSync(path.join(rootDirectory, svgFile)))
    {
        problems.push("outlines/" + id + ".yml: has no " + svgFile + (record.trace ? "; run npm run trace" : ""));

        return undefined;
    }

    const svg = fs.readFileSync(path.join(rootDirectory, svgFile), "utf8");

    checkSvg(svg, svgFile, problems);

    return { ...record, svg };
}

/**
 * Find the outline files: each in the folder of its first letter, such as outlines/t/.
 *
 * @param problems - Where to add problems about files in the wrong place.
 * @returns The paths of the records and of the SVG files, under outlines/ and without their
 * extensions.
 */
export function findOutlineFiles(problems: Array<string>): [Set<string>, Set<string>]
{
    const recordIds = new Set<string>();
    const svgIds = new Set<string>();

    for (const folder of fs.readdirSync(outlinesDirectory, { withFileTypes: true }))
    {
        if (!folder.isDirectory())
        {
            problems.push("outlines/" + folder.name + ": outlines go in the folder of their first letter, such as outlines/t/");
            continue;
        }

        if (!/^[a-z0-9]$/.test(folder.name))
        {
            problems.push("outlines/" + folder.name + "/: folders are single lowercase letters or digits");
            continue;
        }

        for (const name of fs.readdirSync(path.join(outlinesDirectory, folder.name)).sort())
        {
            const extension = path.extname(name);
            const base = path.basename(name, extension);
            const id = folder.name + "/" + base;

            if (extension !== ".yml" && extension !== ".svg")
            {
                problems.push("outlines/" + id + extension + ": only .yml records and .svg outlines belong here");
            }
            else if (!base.startsWith(folder.name))
            {
                problems.push("outlines/" + id + extension + ": belongs in outlines/" + base.charAt(0) + "/");
            }
            else if (!idPattern.test(base))
            {
                problems.push("outlines/" + id + extension + ": file names are lowercase words joined by hyphens");
            }
            else
            {
                (extension === ".yml" ? recordIds : svgIds).add(id);
            }
        }
    }

    return [recordIds, svgIds];
}

/**
 * Read the outlines and check them.
 *
 * @returns The outlines and any problems.
 */
export function readMediaSource(): MediaSource
{
    const problems = new Array<string>();
    const outlines = new Array<Outline>();
    const [recordIds, svgIds] = findOutlineFiles(problems);

    for (const id of svgIds)
    {
        if (!recordIds.has(id))
        {
            problems.push("outlines/" + id + ".svg: has no outlines/" + id + ".yml record");
        }
    }

    const outlineByTaxon = new Map<string, string>();

    for (const id of [...recordIds].sort())
    {
        const outline = readOutline(id, problems);

        if (!outline)
        {
            continue;
        }

        const earlier = outlineByTaxon.get(outline.taxon);

        if (earlier)
        {
            problems.push("outlines/" + id + ".yml: " + outline.taxon + " already has an outline, " + earlier);
        }

        outlineByTaxon.set(outline.taxon, id);
        outlines.push(outline);
    }

    return { outlines, problems };
}
