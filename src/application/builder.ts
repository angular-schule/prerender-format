import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { ApplicationBuilderOptions, buildApplication } from '@angular/build';
import * as path from 'path';

import { getPrerenderCalls, installFileFormat } from './file-format';
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

/**
 * Runs `@angular/build:application` and, with `prerenderFormat: "file"`,
 * writes prerendered routes as `foo.html` instead of `foo/index.html`.
 * Exported separately for testing purposes.
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
    context.logger.error(
      `❌ 'prerenderFormat: "file"' requires 'outputMode: "static"': ` +
        `the Angular SSR server looks up prerendered pages as 'index.html'.`
    );
    yield { success: false };

    return;
  }

  try {
    installFileFormat(path.dirname(require.resolve('@angular/build/package.json')));
  } catch (e) {
    context.logger.error('❌ ' + (e instanceof Error ? e.message : String(e)));
    yield { success: false };

    return;
  }

  // Every successful build must have passed its prerendered pages through the wrapper.
  // Otherwise nothing was prerendered, or @angular/build no longer calls the wrapped function.
  let callsBefore = getPrerenderCalls();
  for await (const result of buildApplication(applicationOptions, context)) {
    const calls = getPrerenderCalls();
    if (result.success && calls === callsBefore) {
      context.logger.error(
        `❌ 'prerenderFormat: "file"' had no effect: no pages were prerendered through @angular-schule/prerender-format. ` +
          `Check that prerendering is enabled ('outputMode: "static"' with server routes, or 'prerender'). ` +
          `If it is, this version of @angular/build is not supported.`
      );
      yield { ...result, success: false };
    } else {
      yield result;
    }
    callsBefore = calls;
  }
}

export default createBuilder<Schema>(executeBuild);
