import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { parse } from "yaml";

// Reads the outline records and their SVG files, and finds problems in them.

/**
 * An outline: an SVG file and the record that says what it shows and where it came from.
 */
export type Outline = {
    /**
     * The file name without its extension, such as "titanosauria".
     */
    id: string;

    /**
     * The clade the outline stands for, as the dataset names it.
     */
    clade: string;

    /**
     * What the outline shows, for its caption: "Outline of a titanosaur".
     */
    title: string;

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
     * The SVG file's text.
     */
    svg: string;
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

// The licenses an image may carry: none that would add conditions to the site using it.
export const allowedLicenses = new Set(["CC0-1.0", "CC-BY-3.0", "CC-BY-4.0"]);

// The fields an outline record may have.
const outlineFields = new Set(["clade", "title", "creator", "source", "license"]);

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
 * Read one outline's record and SVG file.
 *
 * @param id - The outline's file name without its extension.
 * @param problems - Where to add problems.
 * @returns The outline, or undefined if its files cannot be used.
 */
function readOutline(id: string, problems: Array<string>): Outline | undefined
{
    const recordFile = "outlines/" + id + ".yml";
    const svgFile = "outlines/" + id + ".svg";
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

    if (!isCleanText(fields.clade) || !isCleanText(fields.title) || !isCleanText(fields.creator) || !isCleanText(fields.source) || !isCleanText(fields.license))
    {
        problems.push(recordFile + ": needs a clade, a title, a creator, a source and a license");

        return undefined;
    }

    if (!allowedLicenses.has(fields.license))
    {
        problems.push(recordFile + ": the license " + fields.license + " is not one of " + [...allowedLicenses].join(", "));
    }

    if (!fields.source.startsWith("https://"))
    {
        problems.push(recordFile + ": the source must be an https:// address");
    }

    if (!fs.existsSync(path.join(rootDirectory, svgFile)))
    {
        problems.push(recordFile + ": has no " + svgFile);

        return undefined;
    }

    const svg = fs.readFileSync(path.join(rootDirectory, svgFile), "utf8");

    checkSvg(svg, svgFile, problems);

    return { id, clade: fields.clade, title: fields.title, creator: fields.creator, source: fields.source, license: fields.license, svg };
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
    const ids = new Set<string>();
    const svgIds = new Set<string>();

    for (const name of fs.readdirSync(outlinesDirectory).sort())
    {
        const extension = path.extname(name);
        const id = path.basename(name, extension);

        if (extension === ".yml")
        {
            ids.add(id);
        }
        else if (extension === ".svg")
        {
            svgIds.add(id);
        }
        else if (name !== ".gitkeep")
        {
            problems.push("outlines/" + name + ": only .yml records and .svg outlines belong here");
        }
    }

    for (const id of svgIds)
    {
        if (!ids.has(id))
        {
            problems.push("outlines/" + id + ".svg: has no outlines/" + id + ".yml record");
        }
    }

    const outlineByClade = new Map<string, string>();

    for (const id of ids)
    {
        if (!idPattern.test(id))
        {
            problems.push("outlines/" + id + ".yml: file names are lowercase words joined by hyphens");
        }

        const outline = readOutline(id, problems);

        if (!outline)
        {
            continue;
        }

        const earlier = outlineByClade.get(outline.clade);

        if (earlier)
        {
            problems.push("outlines/" + id + ".yml: " + outline.clade + " already has an outline, " + earlier);
        }

        outlineByClade.set(outline.clade, id);
        outlines.push(outline);
    }

    return { outlines, problems };
}
