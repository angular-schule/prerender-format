# CLAUDE.md

This file provides guidance when working with code in this repository.

## Overview

`@angular-schule/prerender-format` is an Angular CLI builder that wraps `@angular/build:application`. With `prerenderFormat: "file"`, prerendered routes are written as `foo.html` instead of `foo/index.html`, so static hosts serve `/foo` without a trailing slash redirect. It implements the idea from [angular/angular-cli#29173](https://github.com/angular/angular-cli/issues/29173); the pull request [angular/angular-cli#34180](https://github.com/angular/angular-cli/pull/34180) adds the same option to Angular itself. Structure and conventions follow [angular-cli-ghpages](https://github.com/angular-schule/angular-cli-ghpages).

## Development Commands

All development commands must be run from the `src` directory:

```bash
cd src
```

**IMPORTANT:** The `src/.npmrc` file contains `ignore-scripts=false` to override global npm settings. **DO NOT DELETE OR MODIFY this file** - it's required for build scripts to run.

### Build
```bash
npm run build
```
Build process: `prebuild` (clean) → `build` (tsc) → `postbuild` (copy metadata, schema, README and LICENSE to dist/).

### Schema
```bash
npm run build:schema
```
`application/schema.json` is generated: the schema of `@angular/build:application` from the installed version plus `prerenderFormat`. Regenerate it after updating `@angular/build` and commit the result. `npm test` fails if it is out of sync.

### Test
```bash
npm test
```

### Local Development

For testing changes locally with an Angular project:

1. Build and pack from `src/dist`:
   ```bash
   cd src
   npm run build
   cd dist
   npm pack
   ```

2. In your Angular test project:
   ```bash
   npm install --save-dev /path/to/angular-schule-prerender-format-X.X.X.tgz
   ng add @angular-schule/prerender-format
   ng build
   ```

### Publishing

Publishing uses [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers) with OIDC – no tokens stored in CI!

1. Go to **Actions** → **Publish to npm**
2. Click **Run workflow** → select branch
3. Leave "Dry-run" checked to test, or uncheck for real publish
4. Wait for approval (environment `npm-publish`)

Publishes with provenance attestation for supply chain security.

The trusted publisher on npmjs.com (package settings, GitHub Actions: `angular-schule` / `prerender-format` / `npm-publish.yml` / environment `npm-publish`) needs **Allowed actions: Allow `npm publish`** checked. Without it, only `npm stage publish` is allowed, and the workflow fails with `E403 … OIDC permission denied for this action`.

For pre-release versions, after publishing:
```bash
npm dist-tag add @angular-schule/prerender-format@X.X.X-rc.X next
```

## Principle: warn and fall back, never fail

The option must never make a build fail. Whenever the "file" format does not apply, log a warning and keep the behavior of `@angular/build:application` (`<route>/index.html`), for the whole build or for a single route. No `throw` and no `try/catch` for control flow: functions that can fail return a result (see `InstallResult`). The only exceptions are the `SchematicsException`s of `ng add` for invalid input, as the Angular schematics API expects.

## Architecture

1. **Builder** (`src/application/`):
   - `builder.ts` - Angular builder entry point, called by `ng build`. Strips `prerenderFormat` and delegates to `buildApplication`. Whenever the "file" format does not apply (a server is produced, the internals of `@angular/build` differ, nothing went through the wrapper), it logs a warning and the build behaves like `@angular/build:application`.
   - `ships-server.ts` - The rule for "this build ships an SSR server", shared by builder and `ng add`.
   - `file-format.ts` - Wraps the internal `prerenderPages()` of `@angular/build`. `execute-post-bundle.js` reads it from the module's exports object at call time, so replacing the export takes effect for regular and localized builds.
   - `schema.json` - Generated, see above.

2. **Schematic** (`src/ng-add.ts`):
   - Implements `ng add @angular-schule/prerender-format`
   - Swaps the build target's builder and sets `prerenderFormat: "file"`
   - Warns if the build target or one of its configurations produces an SSR server

### Internal API

`prerenderPages()` in `@angular/build/src/utils/server-rendering/prerender.js` is not public. If the module or the export is missing, `installFileFormat()` returns the reason and the builder warns instead of patching, and `file-format.spec.ts` checks the call site in `execute-post-bundle.js`. The package supports Angular 22 only. `.github/scripts/test-angular-app.sh` builds a fresh Angular app (lowest and latest 22.x in CI) and checks `ng add`, the server warning, the "file" output for two locales and the `/index` fallback.
