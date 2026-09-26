import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { ApplicationBuilderOptions, buildApplication } from '@angular/build';
import * as path from 'path';

import { getPrerenderCalls, installFileFormat, setReservedFiles } from './file-format';
import { shipsServer } from './ships-server';

export type PrerenderFormat = 'directory' | 'file';

export interface Schema extends ApplicationBuilderOptions {
  /**
   * File layout of prerendered routes.
   * - `directory` (default): `foo/index.html`
   * - `file`: `foo.html`, the start page stays `index.html`
   */
  prerenderFormat?: PrerenderFormat;
}

/** Top-level file names of the build that a prerendered route must not take over. */
function reservedFiles(options: ApplicationBuilderOptions): string[] {
  const files = ['index.csr.html', 'index.server.html'];
  const index = options.index as unknown;
  if (index && typeof index === 'object' && typeof (index as { output?: unknown }).output === 'string') {
    files.push(path.posix.basename((index as { output: string }).output));
  }

  return files;
}

/**
 * Runs `@angular/build:application` and, with `prerenderFormat: "file"`,
 * writes prerendered routes as `foo.html` instead of `foo/index.html`.
 * Whenever the "file" format does not apply, the build behaves like `@angular/build:application`
 * and logs a warning. Exported separately for testing purposes.
 */
export async function* executeBuild(
  options: Schema,
  context: BuilderContext
): AsyncIterable<BuilderOutput> {
  const { prerenderFormat = 'directory', ...applicationOptions } = options;

  if (prerenderFormat !== 'file') {
    yield* buildApplication(applicationOptions, context);

    return;
  }

  if (shipsServer(applicationOptions)) {
    context.logger.warn(
      `The "prerenderFormat" option set to "file" is not considered when the build produces a server ` +
        `("outputMode" set to "server", or "ssr" without "outputMode"). Prerendered routes are written to '<route>/index.html'.`
    );
    yield* buildApplication(applicationOptions, context);

    return;
  }

  const install = installFileFormat(path.dirname(require.resolve('@angular/build/package.json')));
  if (!install.installed) {
    context.logger.warn(`The "prerenderFormat" option set to "file" is not considered: ${install.reason}`);
    yield* buildApplication(applicationOptions, context);

    return;
  }
  setReservedFiles(reservedFiles(applicationOptions));

  // A successful build whose pages did not pass through the wrapper kept the directory layout:
  // nothing was prerendered, or this version of @angular/build no longer calls the wrapped function.
  let callsBefore = getPrerenderCalls();
  for await (const result of buildApplication(applicationOptions, context)) {
    const calls = getPrerenderCalls();
    if (result.success && calls === callsBefore) {
      context.logger.warn(
        `The "prerenderFormat" option set to "file" had no effect: no pages were prerendered through @angular-schule/prerender-format. ` +
          `Check that prerendering is enabled ("outputMode" set to "static" with server routes, or "prerender"). ` +
          `If it is, this version of @angular/build is not supported.`
      );
    }
    yield result;
    callsBefore = calls;
  }
}

export default createBuilder<Schema>(executeBuild);
