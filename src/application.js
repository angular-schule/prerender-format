'use strict';

const path = require('node:path');
const { createBuilder } = require('@angular-devkit/architect');
const { buildApplication } = require('@angular/build');
const { installFlatPrerender } = require('./flat-output');

const angularBuildRoot = path.dirname(require.resolve('@angular/build/package.json'));

/**
 * `@angular/build:application` with the additional option `prerenderOutputStyle`:
 * - `directory` (default): prerendered routes are written as `foo/index.html`.
 * - `flat`: prerendered routes are written as `foo.html`. Only for hosts that serve `foo.html` under `/foo`.
 */
async function* buildFlatApplication(options, context) {
  const { prerenderOutputStyle = 'directory', ...applicationOptions } = options;

  if (prerenderOutputStyle === 'flat') {
    // With 'outputMode: "static"' the SSR entry only renders at build time; every other SSR setup ships a server.
    const shipsServer =
      applicationOptions.outputMode === 'server' ||
      (applicationOptions.outputMode === undefined && !!applicationOptions.ssr);
    if (shipsServer) {
      context.logger.error(
        `'prerenderOutputStyle: "flat"' requires 'outputMode: "static"': the Angular SSR server looks up prerendered pages as 'index.html'.`,
      );
      yield { success: false };

      return;
    }
    installFlatPrerender(angularBuildRoot);
  }

  yield* buildApplication(applicationOptions, context);
}

module.exports = createBuilder(buildFlatApplication);
module.exports.buildFlatApplication = buildFlatApplication;
