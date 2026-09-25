import * as path from 'path';

/** A prerendered page as returned by `prerenderPages()` of `@angular/build`. */
export interface PrerenderedFile {
  content: string;
  appShellRoute: boolean;
}

export type PrerenderOutput = Record<string, PrerenderedFile>;

export interface PrerenderResult {
  output: PrerenderOutput;
  [key: string]: unknown;
}

export type PrerenderPages = (...args: unknown[]) => Promise<PrerenderResult>;

const INDEX_SUFFIX = '/index.html';
const PATCHED = Symbol.for('@angular-schule/flat-prerender:patched');
const PRERENDER_MODULE = 'src/utils/server-rendering/prerender.js';

/**
 * Maps a prerender output path from `foo/index.html` to `foo.html`.
 * The root `index.html` of a build (start page, or locale start page with its base href) stays as is.
 */
export function toFlatPath(outPath: string): string {
  if (!outPath.endsWith(INDEX_SUFFIX)) {
    return outPath;
  }

  return outPath.slice(0, -INDEX_SUFFIX.length) + '.html';
}

/** Renames all keys of a prerender `output` record, failing on collisions. */
export function flattenOutput(output: PrerenderOutput): PrerenderOutput {
  const flat: PrerenderOutput = {};
  for (const [outPath, file] of Object.entries(output)) {
    const flatPath = toFlatPath(outPath);
    if (Object.hasOwn(flat, flatPath)) {
      throw new Error(
        `Flat prerender output: '${outPath}' and another route both map to '${flatPath}'.`
      );
    }
    flat[flatPath] = file;
  }

  return flat;
}

/** Wraps `prerenderPages` so that its `output` record uses flat file names. */
export function wrapPrerenderPages(prerenderPages: PrerenderPages): PrerenderPages {
  const wrapped = async function (this: unknown, ...args: unknown[]) {
    const result = await prerenderPages.apply(this, args);
    if (!result || typeof result.output !== 'object' || result.output === null) {
      throw new Error(
        'Flat prerender output: prerenderPages() returned no output record. ' +
          'This version of @angular/build is not supported.'
      );
    }

    return { ...result, output: flattenOutput(result.output) };
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
export function installFlatPrerender(angularBuildRoot: string): void {
  const modulePath = path.join(angularBuildRoot, PRERENDER_MODULE);
  let prerenderModule: { prerenderPages?: PrerenderPages };
  try {
    prerenderModule = require(modulePath);
  } catch (error) {
    throw new Error(
      `Flat prerender output: cannot load '${modulePath}'. This version of @angular/build is not supported.`,
      { cause: error }
    );
  }

  const descriptor = Object.getOwnPropertyDescriptor(prerenderModule, 'prerenderPages');
  const prerenderPages = prerenderModule.prerenderPages;
  if (typeof prerenderPages !== 'function' || !descriptor?.writable) {
    throw new Error(
      `Flat prerender output: '${modulePath}' exports no replaceable prerenderPages(). ` +
        'This version of @angular/build is not supported.'
    );
  }

  if (!isPatched(prerenderPages)) {
    prerenderModule.prerenderPages = wrapPrerenderPages(prerenderPages);
  }
}
