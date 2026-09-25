# @angular-schule/flat-prerender

An Angular application builder that writes prerendered routes as `foo.html` instead of `foo/index.html`.

Angular's prerendering (SSG) writes every route into its own folder: `blog/my-article` becomes `blog/my-article/index.html`. Static hosts see a folder and redirect `/blog/my-article` to `/blog/my-article/`, and the Angular router then removes the trailing slash again. Every direct visit (search engine, bookmark, shared link) starts with a redirect.

With `prerenderOutputStyle: "flat"`, the same route becomes `blog/my-article.html`. Hosts like GitHub Pages and Cloudflare Pages serve that file under `/blog/my-article` directly.

This is the option proposed in [angular/angular-cli#29173](https://github.com/angular/angular-cli/issues/29173).

## Usage

```bash
npm install --save-dev @angular-schule/flat-prerender
```

In `angular.json`, swap the builder of your build target and set the option:

```json
"build": {
  "builder": "@angular-schule/flat-prerender:application",
  "options": {
    "outputMode": "static",
    "prerenderOutputStyle": "flat"
  }
}
```

All other options are the ones of `@angular/build:application`.

| `prerenderOutputStyle` | Route `blog/my-article` | Start page |
|---|---|---|
| `directory` (default) | `blog/my-article/index.html` | `index.html` |
| `flat` | `blog/my-article.html` | `index.html` |

Parent and child routes live side by side: `blog.html` next to the folder `blog/`. The start page of each locale (base href `/en/`) stays `index.html`.

## Requirements

- `outputMode: "static"`. With a server (`outputMode: "server"` or SSR without `outputMode`) the build fails, because the Angular SSR server looks up prerendered pages as `index.html`. An SSR entry that only renders at build time is fine.
- A host that serves `foo.html` under `/foo` without a redirect. Check your host before switching.
- `@angular/build` 22.

## How it works

The builder calls `buildApplication` from `@angular/build` and wraps its internal `prerenderPages()` function, which returns the prerendered pages as a record of output paths. The wrapper renames `foo/index.html` to `foo.html` before anything is written, so the service worker manifest and all later build steps see the final file names.

`prerenderPages()` is internal API. If a version of `@angular/build` changes it, the build fails with a clear error instead of silently writing `index.html` files.

## Known limitation

The `@angular/build:unit-test` builder logs a warning when its `buildTarget` uses a builder other than `@angular/build:application`. Tests run normally.

## Development

```bash
npm install
npm run build:schema   # regenerates src/schema.json from the installed @angular/build
npm test               # checks the schema and runs the unit tests
```
