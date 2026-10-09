import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { ApplicationBuilderOptions, buildApplication } from '@angular/build';
import * as path from 'path';

import { getPrerenderCalls, installFileFormat } from './file-format';
import { shipsServer } from './ships-server';

export type PrerenderFormat = 'directory' | 'file';

type PrerenderObject = Exclude<ApplicationBuilderOptions['prerender'], boolean | undefined>;

export interface Schema extends Omit<ApplicationBuilderOptions, 'prerender'> {
  /**
   * Same as the `prerender` option of `@angular/build:application`, plus `format`:
   * - `directory` (default): `/foo` is written to `foo/index.html`
   * - `file`: `/foo` is written to `foo.html`, the start page stays `index.html`
   */
  prerender?: boolean | (PrerenderObject & { format?: PrerenderFormat });
}

/**
 * Splits `prerender.format` from the options that `@angular/build:application` understands.
 * With `outputMode`, `@angular/build` does not consider the `prerender` option and warns about it.
 * `format` is considered there, so a `prerender` object that only carries `format` (and the default
 * `discoverRoutes: true`) is dropped when the build prerenders pages, to avoid that warning.
 */
export function toApplicationOptions(options: Schema): {
  applicationOptions: ApplicationBuilderOptions;
  format: PrerenderFormat;
} {
  const { prerender, ...rest } = options;
  if (typeof prerender !== 'object' || prerender === null) {
    return { applicationOptions: { ...rest, prerender }, format: 'directory' };
  }

  const { format = 'directory', ...prerenderOptions } = prerender;
  const onlyFormat = prerenderOptions.routesFile === undefined && prerenderOptions.discoverRoutes !== false;
  const dropPrerender = rest.outputMode !== undefined && !!rest.server && onlyFormat;

  return {
    applicationOptions: { ...rest, prerender: dropPrerender ? undefined : prerenderOptions },
    format
  };
}

/**
 * Runs `@angular/build:application` and, with `prerender.format: "file"`,
 * writes prerendered routes as `foo.html` instead of `foo/index.html`.
 * Whenever the "file" format does not apply, the build behaves like `@angular/build:application`
 * and logs a warning. Exported separately for testing purposes.
 */
export async function* executeBuild(
  options: Schema,
  context: BuilderContext
): AsyncIterable<BuilderOutput> {
  const { applicationOptions, format } = toApplicationOptions(options);

  if (format !== 'file') {
    yield* buildApplication(applicationOptions, context);

    return;
  }

  if (shipsServer(applicationOptions)) {
    context.logger.warn('The "prerender.format" option is not considered when the build produces a server.');
    yield* buildApplication(applicationOptions, context);

    return;
  }

  const install = installFileFormat(path.dirname(require.resolve('@angular/build/package.json')));
  if (!install.installed) {
    context.logger.warn(`The "prerender.format" option is not considered: ${install.reason}`);
    yield* buildApplication(applicationOptions, context);

    return;
  }

  // A successful build whose pages did not pass through the wrapper kept the directory layout:
  // nothing was prerendered, or this version of @angular/build no longer calls the wrapped function.
  let callsBefore = getPrerenderCalls();
  for await (const result of buildApplication(applicationOptions, context)) {
    const calls = getPrerenderCalls();
    if (result.success && calls === callsBefore) {
      context.logger.warn(
        `The "prerender.format" option had no effect: no pages were prerendered through @angular-schule/prerender-format. ` +
          `Check that prerendering is enabled ("outputMode" set to "static" with server routes, or "prerender"). ` +
          `If it is, this version of @angular/build is not supported.`
      );
    }
    yield result;
    callsBefore = calls;
  }
}

export default createBuilder<Schema>(executeBuild);
