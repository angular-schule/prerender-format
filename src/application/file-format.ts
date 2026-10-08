import * as fs from 'fs';
import * as path from 'path';

/** A prerendered page as returned by `prerenderPages()` of `@angular/build`. */
export interface PrerenderedFile {
  content: string;
  appShellRoute: boolean;
}

export type PrerenderOutput = Record<string, PrerenderedFile>;

export interface PrerenderResult {
  output: PrerenderOutput;
  warnings?: string[];
  [key: string]: unknown;
}

export type PrerenderPages = (...args: unknown[]) => Promise<PrerenderResult>;

const INDEX_FILE = 'index.html';
const INDEX_SUFFIX = '/' + INDEX_FILE;
const PATCHED = Symbol.for('@angular-schule/prerender-format:patched');
const PRERENDER_MODULE = 'src/utils/server-rendering/prerender.js';

let prerenderCalls = 0;

/** Number of `prerenderPages()` calls that went through the wrapper in this process. */
export function getPrerenderCalls(): number {
  return prerenderCalls;
}

/**
 * Maps a prerender output path from `foo/index.html` to `foo.html`.
 * The root `index.html` of a build (start page, or locale start page with its base href) stays as is.
 */
export function toFilePath(outPath: string): string {
  if (!outPath.endsWith(INDEX_SUFFIX)) {
    return outPath;
  }

  return outPath.slice(0, -INDEX_SUFFIX.length) + '.html';
}

/** Renames all keys of a prerender `output` record from `foo/index.html` to `foo.html`. */
export function toFileOutput(output: PrerenderOutput): PrerenderOutput {
  const renamed: PrerenderOutput = {};
  for (const [outPath, file] of Object.entries(output)) {
    renamed[toFilePath(outPath)] = file;
  }

  return renamed;
}

/**
 * Wraps `prerenderPages` so that its `output` record uses the "file" format.
 * An unknown result is passed through unchanged.
 */
export function wrapPrerenderPages(prerenderPages: PrerenderPages): PrerenderPages {
  const wrapped = async function (this: unknown, ...args: unknown[]) {
    const result = await prerenderPages.apply(this, args);
    if (
      !result ||
      typeof result.output !== 'object' ||
      result.output === null ||
      !Array.isArray(result.warnings)
    ) {
      return result;
    }
    prerenderCalls++;

    return { ...result, output: toFileOutput(result.output) };
  };
  Object.defineProperty(wrapped, PATCHED, { value: true });

  return wrapped;
}

function isPatched(fn: PrerenderPages): boolean {
  return (fn as unknown as Record<symbol, unknown>)[PATCHED] === true;
}

export type InstallResult = { installed: true } | { installed: false; reason: string };

/**
 * Replaces `prerenderPages` of the given `@angular/build` installation.
 * `execute-post-bundle.js` reads the function from the module's exports object on every call,
 * so the replacement takes effect for regular and localized builds alike.
 * Returns the reason instead of replacing anything when the internals are not as expected.
 */
export function installFileFormat(angularBuildRoot: string): InstallResult {
  const modulePath = path.join(angularBuildRoot, PRERENDER_MODULE);
  if (!fs.existsSync(modulePath)) {
    return { installed: false, reason: `'${modulePath}' does not exist. This version of @angular/build is not supported.` };
  }

  const prerenderModule: { prerenderPages?: PrerenderPages } = require(modulePath);
  const descriptor = Object.getOwnPropertyDescriptor(prerenderModule, 'prerenderPages');
  const prerenderPages = prerenderModule.prerenderPages;
  if (typeof prerenderPages !== 'function' || !descriptor?.writable) {
    return {
      installed: false,
      reason: `'${modulePath}' exports no replaceable prerenderPages(). This version of @angular/build is not supported.`
    };
  }

  if (!isPatched(prerenderPages)) {
    prerenderModule.prerenderPages = wrapPrerenderPages(prerenderPages);
  }

  return { installed: true };
}
