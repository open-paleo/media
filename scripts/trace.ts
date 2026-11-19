import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import sharp from "sharp";

import type { OutlineRecord, TraceSettings } from "./media-source.ts";
import { findOutlineFiles, readOutlineRecord, rootDirectory } from "./media-source.ts";
import type { RgbaImage, TraceReport } from "./trace/outline-tracer.ts";
import { traceOutline } from "./trace/outline-tracer.ts";
import { potraceTracer } from "./trace/potrace.ts";

// Traces the outlines whose records have a trace block, writing each SVG beside its record.
//
//   npm run trace                         every traced outline
//   npm run trace -- p/protoceratops      only these
//   npm run trace -- --check              retrace and compare with the SVGs, writing nothing

// Wikimedia asks automated clients to name themselves and how to reach whoever runs them.
const userAgent = "open-paleo-media/1.0 (https://github.com/open-paleo/media)";

// Downloaded images, by SHA-1, so a retrace doesn't fetch them again.
const cacheDirectory = path.join(rootDirectory, "scratch", "trace-images");

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
 * Decode an image file into pixels.
 *
 * @param bytes - The file's contents.
 * @returns The pixels.
 */
async function decodeImage(bytes: Buffer): Promise<RgbaImage>
{
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    return { width: info.width, height: info.height, data };
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
        report.linesErased + " ground lines erased",
        report.cavitiesFilled + " cavities filled",
    ];

    for (const [x, y] of report.keepOpenMissed)
    {
        parts.push("keep-open point [" + x + ", " + y + "] is on the drawing, not in an open space");
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
    let differing = 0;

    for (const record of records)
    {
        const trace = record.trace as TraceSettings;
        const svgFile = path.join(rootDirectory, "outlines", record.id + ".svg");
        const image = await decodeImage(await readTraceImage(trace));
        const result = await traceOutline(image, { threshold: trace.threshold, keepOpen: trace.keepOpen }, potraceTracer);

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
