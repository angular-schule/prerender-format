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

export interface FileOutputResult {
  output: PrerenderOutput;
  warnings: string[];
}

const INDEX_FILE = 'index.html';
const INDEX_SUFFIX = '/' + INDEX_FILE;
const PATCHED = Symbol.for('@angular-schule/prerender-format:patched');
const PRERENDER_MODULE = 'src/utils/server-rendering/prerender.js';

let prerenderCalls = 0;
let reservedFiles: string[] = [];

/** Number of `prerenderPages()` calls that went through the wrapper in this process. */
export function getPrerenderCalls(): number {
  return prerenderCalls;
}

/** Top-level file names that a route must not take over, such as the CSR index `index.csr.html`. */
export function setReservedFiles(files: string[]): void {
  reservedFiles = files.map(file => file.toLowerCase());
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

/** Route of an output path, for messages: `blog/index/index.html` → `/blog/index`. */
function routeOf(outPath: string): string {
  if (outPath === INDEX_FILE) {
    return '/';
  }

  return '/' + (outPath.endsWith(INDEX_SUFFIX) ? outPath.slice(0, -INDEX_SUFFIX.length) : outPath);
}

/**
 * Renames all keys of a prerender `output` record from `foo/index.html` to `foo.html`.
 * A route keeps `foo/index.html` (with a warning) when `foo.html` is not safe:
 * - its last segment is `index` in any letter case: `index.html` is served for the parent path,
 *   and on macOS and Windows `Index.html` is the same file as `index.html`,
 * - the file name is reserved, such as the CSR index `index.csr.html`,
 * - another route already uses the file name (compared case-insensitively).
 */
export function toFileOutput(output: PrerenderOutput, reserved: string[] = reservedFiles): FileOutputResult {
  const renamed: PrerenderOutput = {};
  const warnings: string[] = [];
  const usedFiles = new Map<string, string>();
  const reservedLower = reserved.map(file => file.toLowerCase());

  for (const [outPath, file] of Object.entries(output)) {
    const route = routeOf(outPath);
    const filePath = toFilePath(outPath);
    const lowerFilePath = filePath.toLowerCase();
    const lowerOutPath = outPath.toLowerCase();

    let reason: string | undefined;
    if (filePath !== outPath) {
      if (lowerOutPath.endsWith('/index' + INDEX_SUFFIX) || lowerOutPath === 'index' + INDEX_SUFFIX) {
        reason = `'${filePath}' would be served for '${route.slice(0, -'index'.length)}'`;
      } else if (reservedLower.includes(lowerFilePath)) {
        reason = `'${filePath}' is used by the build itself`;
      } else if (usedFiles.has(lowerFilePath)) {
        reason = `'${filePath}' is already used by route '${usedFiles.get(lowerFilePath)}'`;
      }
    }

    if (reason) {
      warnings.push(`Route '${route}' is written to '${outPath}' instead, because ${reason}.`);
      renamed[outPath] = file;
      continue;
    }

    usedFiles.set(lowerFilePath, route);
    renamed[filePath] = file;
  }

  return { output: renamed, warnings };
}

/**
 * Wraps `prerenderPages` so that its `output` record uses the "file" format.
 * Routes that keep the directory format are reported as build warnings of `prerenderPages`.
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

    const { output, warnings } = toFileOutput(result.output);

    return { ...result, output, warnings: [...(result.warnings as string[]), ...warnings] };
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
