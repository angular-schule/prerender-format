import { BuilderContext, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { ApplicationBuilderOptions, buildApplication } from '@angular/build';
import * as path from 'path';

import { installFlatPrerender } from './flat-output';

export type PrerenderOutputStyle = 'directory' | 'flat';

export interface Schema extends ApplicationBuilderOptions {
  /**
   * File layout of prerendered routes.
   * - `directory` (default): `foo/index.html`
   * - `flat`: `foo.html`, the start page stays `index.html`
   */
  prerenderOutputStyle?: PrerenderOutputStyle;
}

/**
 * Runs `@angular/build:application` and, with `prerenderOutputStyle: "flat"`,
 * writes prerendered routes as `foo.html` instead of `foo/index.html`.
 * Exported separately for testing purposes.
 */
export async function* executeBuild(
  options: Schema,
  context: BuilderContext
): AsyncIterable<BuilderOutput> {
  const { prerenderOutputStyle = 'directory', ...applicationOptions } = options;

  if (prerenderOutputStyle === 'flat') {
    // With 'outputMode: "static"' the SSR entry only renders at build time; every other SSR setup ships a server.
    const shipsServer =
      applicationOptions.outputMode === 'server' ||
      (applicationOptions.outputMode === undefined && !!applicationOptions.ssr);
    if (shipsServer) {
      context.logger.error(
        `❌ 'prerenderOutputStyle: "flat"' requires 'outputMode: "static"': ` +
          `the Angular SSR server looks up prerendered pages as 'index.html'.`
      );
      yield { success: false };

      return;
    }

    try {
      installFlatPrerender(path.dirname(require.resolve('@angular/build/package.json')));
    } catch (e) {
      context.logger.error('❌ ' + (e instanceof Error ? e.message : String(e)));
      yield { success: false };

      return;
    }
  }

  yield* buildApplication(applicationOptions, context);
}

export default createBuilder<Schema>(executeBuild);
