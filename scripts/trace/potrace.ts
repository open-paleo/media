import { createRequire } from "node:module";
import * as path from "node:path";
import * as url from "node:url";

import type { BitmapTracer, RgbaImage } from "./outline-tracer.ts";

// Runs potrace, from the WebAssembly build in esm-potrace-wasm, under Node.

/**
 * The parts of esm-potrace-wasm this uses.
 */
type PotraceModule = {
    /**
     * Load the WebAssembly module; once, before tracing.
     */
    init: () => Promise<void>;

    /**
     * Trace an image into SVG.
     */
    potrace: (image: RgbaImage, options: PotraceOptions) => Promise<string>;
};

/**
 * potrace's settings, as esm-potrace-wasm names them.
 */
type PotraceOptions = {
    /**
     * The area of the largest speck to drop, in pixels.
     */
    turdsize: number;

    /**
     * How to resolve ambiguous corners: 4 is "minority".
     */
    turnpolicy: number;

    /**
     * How smooth corners are: 1 is potrace's default.
     */
    alphamax: number;

    /**
     * Whether to join curves where it changes the shape little: 1 is yes.
     */
    opticurve: number;

    /**
     * How much joining curves may change the shape.
     */
    opttolerance: number;

    /**
     * Whether to return path data alone rather than a whole SVG file.
     */
    pathonly: boolean;

    /**
     * Whether to trace each color separately; the input is black and white.
     */
    extractcolors: boolean;

    /**
     * Gray levels to separate when tracing colors; unused here.
     */
    posterizelevel: number;

    /**
     * How to separate gray levels; unused here.
     */
    posterizationalgorithm: number;
};

/**
 * The CommonJS globals the WebAssembly loader expects under Node.
 */
type CommonJsGlobals = {
    /**
     * The require function.
     */
    require?: NodeJS.Require;

    /**
     * The loader's directory.
     */
    __dirname?: string;
};

let loadedModule: PotraceModule | undefined;

/**
 * Load potrace, once.
 *
 * @returns The module.
 */
async function loadPotrace(): Promise<PotraceModule>
{
    if (!loadedModule)
    {
        const globals = globalThis as CommonJsGlobals;

        globals.require ??= createRequire(import.meta.url);
        globals.__dirname ??= path.dirname(url.fileURLToPath(import.meta.url));

        const potraceModule = await import("esm-potrace-wasm") as unknown as PotraceModule;

        await potraceModule.init();
        loadedModule = potraceModule;
    }

    return loadedModule;
}

/**
 * Trace a black-on-white image into SVG with potrace.
 *
 * @param image - The image.
 * @param speckleArea - The area of the largest speck to drop, in pixels.
 * @returns The SVG.
 */
export async function traceWithPotrace(image: RgbaImage, speckleArea: number): Promise<string>
{
    const potraceModule = await loadPotrace();

    return potraceModule.potrace(image, {
        turdsize: speckleArea,
        turnpolicy: 4,
        alphamax: 1,
        opticurve: 1,
        opttolerance: 0.2,
        pathonly: false,
        extractcolors: false,
        posterizelevel: 2,
        posterizationalgorithm: 0,
    });
}

export const potraceTracer: BitmapTracer = traceWithPotrace;
