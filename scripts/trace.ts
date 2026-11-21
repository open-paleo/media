import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import sharp from "sharp";

import type { OutlineRecord, TraceSettings } from "./media-source.ts";
import { findOutlineFiles, readOutlineRecord, rootDirectory } from "./media-source.ts";
import type { BitmapTracer, RgbaImage, TraceReport } from "@open-paleo/outline-tracer";
import { traceOutline } from "@open-paleo/outline-tracer";
import { loadNodeTracer } from "@open-paleo/outline-tracer/node";

// Traces the outlines whose records have a trace block, writing each SVG beside its record.
//
//   npm run trace                         every traced outline
//   npm run trace -- p/protoceratops      only these
//   npm run trace -- --check              retrace and compare with the SVGs, writing nothing

// Wikimedia asks automated clients to name themselves and how to reach whoever runs them.
const userAgent = "open-paleo-media/1.0 (https://github.com/open-paleo/media)";

// Downloaded images, by SHA-1, so a retrace doesn't fetch them again.
const cacheDirectory = path.join(rootDirectory, "scratch", "trace-images");

// SVG figures are rasterized at this width to trace them, as wide as the tracer works.
const svgWidth = 2400;

/**
 * A figure ready to trace.
 */
type DecodedFigure = {
    /**
     * Its pixels.
     */
    image: RgbaImage;

    /**
     * Pixels per unit of the figure's own size: 1 for a raster image, more for an SVG rasterized
     * larger than its own size. A record's points are in the figure's own units.
     */
    unitScale: number;
};

// The wait between downloads, and the most attempts at one, in milliseconds and tries.
const downloadPause = 2000;
const downloadAttempts = 5;

/**
 * Wait.
 *
 * @param milliseconds - How long.
 * @returns When the time is up.
 */
function waitFor(milliseconds: number): Promise<void>
{
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Get a file's SHA-1.
 *
 * @param bytes - The file's contents.
 * @returns The SHA-1, in hex.
 */
function getSha1(bytes: Uint8Array): string
{
    return crypto.createHash("sha1").update(bytes).digest("hex");
}

/**
 * Download a trace's image, or read it from the cache, refusing it if its SHA-1 differs.
 *
 * @param trace - The trace's settings.
 * @returns The image file's contents.
 */
async function readTraceImage(trace: TraceSettings): Promise<Buffer>
{
    const cached = path.join(cacheDirectory, trace.sha1);

    if (fs.existsSync(cached))
    {
        return fs.readFileSync(cached);
    }

    for (let attempt = 1; attempt <= downloadAttempts; attempt++)
    {
        const response = await fetch(trace.image, { headers: { "User-Agent": userAgent } });

        if (response.status === 429 && attempt < downloadAttempts)
        {
            const wait = Number(response.headers.get("Retry-After") ?? "0") * 1000 || 30000 * attempt;

            console.log("  " + trace.image + " is rate limited; waiting " + wait / 1000 + " s");
            await waitFor(wait);
            continue;
        }

        if (!response.ok)
        {
            throw new Error("Could not download " + trace.image + ": HTTP " + response.status);
        }

        const bytes = Buffer.from(await response.arrayBuffer());
        const sha1 = getSha1(bytes);

        if (sha1 !== trace.sha1)
        {
            throw new Error(trace.image + " has SHA-1 " + sha1 + ", not " + trace.sha1 + ": the file has changed since it was traced.");
        }

        fs.mkdirSync(cacheDirectory, { recursive: true });
        fs.writeFileSync(cached, bytes);
        await waitFor(downloadPause);

        return bytes;
    }

    throw new Error("Could not download " + trace.image);
}

/**
 * Decode an image file into pixels, rasterizing an SVG at the width the tracer works at.
 *
 * @param bytes - The file's contents.
 * @returns The pixels, and how they relate to the figure's own units.
 */
async function decodeImage(bytes: Buffer): Promise<DecodedFigure>
{
    // An SVG's own size can be far over sharp's pixel limit even though it is rasterized at a fixed
    // width, so the limit is lifted for SVGs alone.
    const metadata = await sharp(bytes, { limitInputPixels: false }).metadata();
    const isSvg = metadata.format === "svg";
    const decoder = isSvg ? sharp(bytes, { density: 72 * svgWidth / (metadata.width ?? svgWidth), limitInputPixels: false }) : sharp(bytes);
    const { data, info } = await decoder.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    return { image: { width: info.width, height: info.height, data }, unitScale: isSvg ? info.width / (metadata.width ?? info.width) : 1 };
}

/**
 * Scale a point from the figure's own units to the decoded pixels.
 *
 * @param point - The point.
 * @param scale - Pixels per unit.
 * @returns The scaled point.
 */
function scalePoint(point: [number, number], scale: number): [number, number]
{
    return [point[0] * scale, point[1] * scale];
}

/**
 * Describe what a trace found and changed, in one line.
 *
 * @param report - The trace's report.
 * @returns The description.
 */
function describeReport(report: TraceReport): string
{
    const parts = [
        report.shapesKept + " shapes kept, " + report.shapesDropped + " dropped",
        report.linesErased + " lines erased",
        report.cavitiesFilled + " cavities filled",
    ];

    for (const [x, y] of report.keepOpenMissed)
    {
        parts.push("keep-open point [" + x + ", " + y + "] is on the drawing, not in an open space");
    }

    for (const [x, y] of report.fillMissed)
    {
        parts.push("fill point [" + x + ", " + y + "] did nothing: on the drawing, or in a space too open");
    }

    if (report.selectMissed)
    {
        parts.push("the select point is far from any drawing, so the largest animal was kept");
    }

    return parts.join("; ");
}

/**
 * Find the records to trace: those named, or every one with a trace block.
 *
 * @param names - The outlines named on the command line, such as "p/protoceratops".
 * @param problems - Where to add problems.
 * @returns The records.
 */
function findTracedRecords(names: Array<string>, problems: Array<string>): Array<OutlineRecord>
{
    const [recordIds] = findOutlineFiles(problems);
    const records = new Array<OutlineRecord>();

    for (const name of names)
    {
        if (!recordIds.has(name))
        {
            problems.push("outlines/" + name + ".yml: no such record");
        }
    }

    for (const id of [...recordIds].sort())
    {
        if (names.length > 0 && !names.includes(id))
        {
            continue;
        }

        const record = readOutlineRecord(id, problems);

        if (record?.trace)
        {
            records.push(record);
        }
        else if (record && names.includes(id))
        {
            problems.push("outlines/" + id + ".yml: has no trace block");
        }
    }

    return records;
}

/**
 * Trace the outlines, or check them.
 */
async function runTrace(): Promise<void>
{
    const isChecking = process.argv.includes("--check");
    const names = process.argv.slice(2).filter((argument) => argument !== "--check");
    const problems = new Array<string>();
    const records = findTracedRecords(names, problems);
    const tracer: BitmapTracer = await loadNodeTracer();
    let differing = 0;

    for (const record of records)
    {
        const trace = record.trace as TraceSettings;
        const svgFile = path.join(rootDirectory, "outlines", record.id + ".svg");
        const figure = await decodeImage(await readTraceImage(trace));
        const keepOpen = new Array<[number, number]>();

        for (const point of trace.keepOpen)
        {
            keepOpen.push(scalePoint(point, figure.unitScale));
        }

        const fill = new Array<[number, number]>();

        for (const point of trace.fill)
        {
            fill.push(scalePoint(point, figure.unitScale));
        }

        const erase = new Array<[number, number, number, number]>();

        for (const [left, top, right, bottom] of trace.erase)
        {
            const [scaledLeft, scaledTop] = scalePoint([left, top], figure.unitScale);
            const [scaledRight, scaledBottom] = scalePoint([right, bottom], figure.unitScale);

            erase.push([scaledLeft, scaledTop, scaledRight, scaledBottom]);
        }

        const eraseLines = new Array<[number, number, number, number, number]>();

        for (const [x1, y1, x2, y2, width] of trace.eraseLines)
        {
            const [scaledX1, scaledY1] = scalePoint([x1, y1], figure.unitScale);
            const [scaledX2, scaledY2] = scalePoint([x2, y2], figure.unitScale);

            eraseLines.push([scaledX1, scaledY1, scaledX2, scaledY2, width * figure.unitScale]);
        }

        const select = trace.select ? scalePoint(trace.select, figure.unitScale) : undefined;
        const options = { threshold: trace.threshold, keepOpen, select, erase, eraseLines, fill, close: trace.close };
        const result = await traceOutline(figure.image, options, tracer);

        console.log(record.id + ": " + describeReport(result.report));

        if (!isChecking)
        {
            fs.writeFileSync(svgFile, result.svg);
        }
        else if (!fs.existsSync(svgFile) || fs.readFileSync(svgFile, "utf8") !== result.svg)
        {
            problems.push("outlines/" + record.id + ".svg: differs from what its trace block gives; run npm run trace -- " + record.id);
            differing++;
        }
    }

    for (const problem of problems)
    {
        console.error(problem);
    }

    console.log((isChecking ? "Checked " : "Traced ") + records.length + " outlines" + (differing > 0 ? "; " + differing + " differ" : ""));

    if (problems.length > 0)
    {
        process.exitCode = 1;
    }
}

await runTrace();
