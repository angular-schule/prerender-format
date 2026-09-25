import * as path from 'path';

/** A prerendered page as returned by `prerenderPages()` of `@angular/build`. */
export interface PrerenderedFile {
  content: string;
  appShellRoute: boolean;
}

export type PrerenderOutput = Record<string, PrerenderedFile>;

export interface PrerenderResult {
  output: PrerenderOutput;
  errors?: string[];
  [key: string]: unknown;
}

export type PrerenderPages = (...args: unknown[]) => Promise<PrerenderResult>;

export interface FileOutputResult {
  output: PrerenderOutput;
  errors: string[];
}

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

/** Route of an output path, for error messages: `blog/index/index.html` → `/blog/index`. */
function routeOf(outPath: string): string {
  if (outPath === INDEX_FILE) {
    return '/';
  }

  return '/' + (outPath.endsWith(INDEX_SUFFIX) ? outPath.slice(0, -INDEX_SUFFIX.length) : outPath);
}

/**
 * Renames all keys of a prerender `output` record.
 * Routes whose last segment is `index` are reported as errors: as `…/index.html` they would be
 * served under the parent path, and `/index` would overwrite the start page.
 */
export function toFileOutput(output: PrerenderOutput): FileOutputResult {
  const renamed: PrerenderOutput = {};
  const errors: string[] = [];
  const routeByFilePath = new Map<string, string>();

  for (const [outPath, file] of Object.entries(output)) {
    const route = routeOf(outPath);
    const filePath = toFilePath(outPath);

    // Case-insensitive: on macOS and Windows, 'Index.html' is the same file as 'index.html'.
    const lowerOutPath = outPath.toLowerCase();
    if (lowerOutPath.endsWith('/index' + INDEX_SUFFIX) || lowerOutPath === 'index' + INDEX_SUFFIX) {
      errors.push(
        `Route '${route}' cannot be prerendered with 'prerenderFormat: "file"': ` +
          `its file '${filePath}' would be served as '${route.slice(0, -'index'.length)}', not as '${route}'. ` +
          `Rename the route or use 'prerenderFormat: "directory"'.`
      );
      continue;
    }

    const existingRoute = routeByFilePath.get(filePath);
    if (existingRoute !== undefined) {
      errors.push(
        `Routes '${existingRoute}' and '${route}' both map to the file '${filePath}' with 'prerenderFormat: "file"'.`
      );
      continue;
    }

    routeByFilePath.set(filePath, route);
    renamed[filePath] = file;
  }

  return { output: renamed, errors };
}

/**
 * Wraps `prerenderPages` so that its `output` record uses the "file" format.
 * Problems are returned as build errors of `prerenderPages`, so Angular reports them like any other build error.
 */
export function wrapPrerenderPages(prerenderPages: PrerenderPages): PrerenderPages {
  const wrapped = async function (this: unknown, ...args: unknown[]) {
    const result = await prerenderPages.apply(this, args);
    if (
      !result ||
      typeof result.output !== 'object' ||
      result.output === null ||
      !Array.isArray(result.errors)
    ) {
      throw new Error(
        '@angular-schule/prerender-format: prerenderPages() returned an unknown result. ' +
          'This version of @angular/build is not supported.'
      );
    }
    prerenderCalls++;

    const { output, errors } = toFileOutput(result.output);

    return { ...result, output, errors: [...result.errors, ...errors] };
  };
  Object.defineProperty(wrapped, PATCHED, { value: true });

  return wrapped;
}

function isPatched(fn: PrerenderPages): boolean {
  return (fn as unknown as Record<symbol, unknown>)[PATCHED] === true;
}

/**
 * Replaces `prerenderPages` of the given `@angular/build` installation.
 * `execute-post-bundle.js` reads the function from the module's exports object on every call,
 * so the replacement takes effect for regular and localized builds alike.
 */
export function installFileFormat(angularBuildRoot: string): void {
  const modulePath = path.join(angularBuildRoot, PRERENDER_MODULE);
  let prerenderModule: { prerenderPages?: PrerenderPages };
  try {
    prerenderModule = require(modulePath);
  } catch (error) {
    throw new Error(
      `@angular-schule/prerender-format: cannot load '${modulePath}'. This version of @angular/build is not supported.`,
      { cause: error }
    );
  }

  const descriptor = Object.getOwnPropertyDescriptor(prerenderModule, 'prerenderPages');
  const prerenderPages = prerenderModule.prerenderPages;
  if (typeof prerenderPages !== 'function' || !descriptor?.writable) {
    throw new Error(
      `@angular-schule/prerender-format: '${modulePath}' exports no replaceable prerenderPages(). ` +
        'This version of @angular/build is not supported.'
    );
  }

  if (!isPatched(prerenderPages)) {
    prerenderModule.prerenderPages = wrapPrerenderPages(prerenderPages);
  }
}
