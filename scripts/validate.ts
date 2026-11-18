import { readMediaSource } from "./media-source.ts";

// Checks the outline records and SVG files and prints any problems.

const source = readMediaSource();

for (const problem of source.problems)
{
    console.error(problem);
}

if (source.problems.length > 0)
{
    console.error(source.problems.length + " problems");
    process.exit(1);
}

console.log(source.outlines.length + " outlines; no problems");
