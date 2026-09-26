# @angular-schule/prerender-format

[![NPM version][npm-image]][npm-url]
[![GitHub Actions](https://github.com/angular-schule/prerender-format/actions/workflows/main.yml/badge.svg)](https://github.com/angular-schule/prerender-format/actions/workflows/main.yml)
[![The MIT License](https://img.shields.io/badge/license-MIT-orange.svg?color=blue&style=flat-square)](http://opensource.org/licenses/MIT)

**Nice looking URLs and flawless SEO for your prerendered Angular app: `blog/my-article.html` instead of `blog/my-article/index.html`, no more trailing slash redirects! 🚀**

**Table of contents:**

1. [💡 Why?](#why)
2. [⚠️ Prerequisites](#prerequisites)
3. [🚀 Quick Start](#quickstart)
4. [⚙️ Installation](#installation)
5. [📦 Options](#options)
6. [🔭 Other frameworks](#other-frameworks)
7. [🌍 Hosts](#hosts)
8. [🔧 How it works](#how-it-works)
9. [📁 Known limitations](#limitations)
10. [🏁 License](#license)

<hr>

## 💡 Why? <a name="why"></a>

### Today: nice URLs or good SEO, you can't have both

Angular's prerendering (SSG) writes every route into its own folder: the route `blog/my-article` becomes `blog/my-article/index.html`.
Static hosts see a folder and redirect `/blog/my-article` to `/blog/my-article/`.
So you have to choose:

- **Nice looking URLs, but redirects:** links have to use `/blog/my-article`. Every direct visit (search engine, bookmark, shared link) starts with a 301/308 redirect to `/blog/my-article/`, and the Angular router then removes the trailing slash again.
- **No redirects, but trailing slashes everywhere:** links have to use `/blog/my-article/`. Pages answer with a status code 200, but every URL ends with a slash, and Angular needs an extra provider to keep it in the address bar: `{ provide: LocationStrategy, useClass: TrailingSlashPathLocationStrategy }` (see [`TrailingSlashPathLocationStrategy`](https://angular.dev/api/common/TrailingSlashPathLocationStrategy)).

### With this builder: nice URLs and good SEO, we deserve both!

The same route becomes `blog/my-article.html`, and hosts like Cloudflare Pages serve it under `/blog/my-article` directly, with a status code 200.

- **Nice looking URLs:** `/blog/my-article`, without a trailing slash, in links, in the address bar and in the server response alike.
- **Flawless SEO:** every page answers directly with a status code 200. Search engines see no redirect, and the URL they crawl is the same one your links point to.
- **Old links keep working:** addresses with a trailing slash redirect to the address without it (measured on Cloudflare Pages, see [Hosts](#hosts)).

The idea comes from [angular/angular-cli#29173](https://github.com/angular/angular-cli/issues/29173), which asks for an option to write `<route>.html` instead of `<route>/index.html`.
The pull request [angular/angular-cli#34180](https://github.com/angular/angular-cli/pull/34180) adds such an option to Angular itself, with the same name and values as this builder: `prerenderFormat`, `'directory'` or `'file'`.
The builder is a stopgap: developed and tested for Angular 22, until Angular has a built-in option and this package is no longer needed.
If you want the option in Angular, please give the issue and the pull request a 👍.

**Read more:** [Static Angular SSR: Nice URLs and good SEO - you can't have both (but here's a fix!)](https://angular.schule/blog/2026-09-static-angular-ssr-trailing-slash)

## ⚠️ Prerequisites <a name="prerequisites"></a>

- Angular 22 with the application builder (`@angular/build:application`)
- `"outputMode": "static"` (with a server, the option is not considered, see [Known limitations](#limitations))
- A host that serves `blog/my-article.html` under `/blog/my-article` without a redirect (see [Hosts](#hosts))

## 🚀 Quick Start <a name="quickstart"></a>

```sh
ng add @angular-schule/prerender-format
ng build
```

## ⚙️ Installation <a name="installation"></a>

`ng add @angular-schule/prerender-format` installs the package and changes the builder of your build target in `angular.json` and sets `prerenderFormat`.
`prerenderFormat: "file"` only applies to static builds. If the build target (or one of its configurations) produces an SSR server, `ng add` still sets it up and shows a warning.

```json
"build": {
  "builder": "@angular-schule/prerender-format:application",
  "options": {
    "outputMode": "static",
    "prerenderFormat": "file"
  }
}
```

All other options stay as they are: the builder accepts every option of `@angular/build:application` and passes it on.
Use `--project` to choose the project in a workspace with several projects.

## 📦 Options <a name="options"></a>

#### prerenderFormat

- **optional**
- Default: `directory`

| `prerenderFormat` | Route `blog/my-article` | Start page |
|---|---|---|
| `directory` | `blog/my-article/index.html` | `index.html` |
| `file` | `blog/my-article.html` | `index.html` |

The name and the values follow Astro's [`build.format`](#other-frameworks).

Parent and child routes live side by side: `blog.html` next to the folder `blog/`.
The start page of each locale (for example with base href `/en/`) stays `index.html`.

If `blog/my-article.html` is not safe for a route, that route keeps `blog/my-article/index.html` and the build shows a warning. This applies to a route whose last segment is `index` in any letter case (`/index`, `/blog/index`), to a file name the build uses itself (such as `index.csr.html`), and to a file name another route already uses.

## 🔭 Other frameworks <a name="other-frameworks"></a>

Static site generators have offered this choice for a long time. We decided to borrow the terminology from Astro: `build.format` with `'directory'` and `'file'` became `prerenderFormat` with the same values.

| Framework | Option | `blog/my-article/index.html` | `blog/my-article.html` |
|---|---|---|---|
| **Astro** | `build.format` | `'directory'` (default) | `'file'` |
| Next.js (static export) | `trailingSlash` | `true` | `false` (default) |
| SvelteKit | `trailingSlash` | `'always'` | `'never'` (default) |
| Nuxt 2 | `generate.subFolders` | `true` (default) | `false` |
| Hugo | `uglyURLs` | `false` (default) | `true` |
| **Angular** | **NEW: `prerenderFormat`** | **`'directory'` (default)** | **`'file'`** |

Astro's documentation recommends `build.format: 'file'` together with `trailingSlash: 'never'`, which is exactly the combination this builder enables for Angular.

## 🌍 Hosts <a name="hosts"></a>

Measured on **Cloudflare Pages** with `prerenderFormat: "file"`:

| Request | Response |
|---|---|
| `/blog/my-article` | 200, `blog/my-article.html` |
| `/blog/my-article/` | 308 → `/blog/my-article` |
| `/blog/my-article.html` | 308 → `/blog/my-article` |
| `/blog` with `blog.html` next to the folder `blog/` | 200, `blog.html` |

Old addresses with a trailing slash keep working, they redirect to the address without it.

GitHub Pages, Firebase Hosting, Vercel and Netlify are listed in the Angular issue as supporting this, some of them behind a setting.
Check your host before switching.

## 🔧 How it works <a name="how-it-works"></a>

The builder calls `buildApplication` from `@angular/build` and wraps its internal `prerenderPages()` function, which returns the prerendered pages as a record of output paths.
The wrapper renames `blog/my-article/index.html` to `blog/my-article.html` before anything is written, so the service worker manifest and all later build steps see the final file names.

`prerenderPages()` is internal API, so this package supports Angular 22 only.
If the prerendered pages did not go through the wrapper (nothing was prerendered, or a version of `@angular/build` with different internals), the build shows a warning and keeps the directory layout.
The option never makes your build fail.

## 📁 Known limitations <a name="limitations"></a>

- **Static builds only, by design.** `prerenderFormat: "file"` solves a problem of static hosting and makes no sense in other setups. An `ssr` entry is fine as long as `"outputMode"` is `"static"`: Angular then uses it only during `ng build` to prerender the pages, and no server is deployed. If a server is deployed, the option is not considered and the build shows a warning: a server needs no `.html` files, it answers `/blog/my-article` directly without redirecting to `/blog/my-article/`, and the Angular SSR server looks up prerendered pages as `index.html`.

  ✅ Works: static output, the `ssr` entry only renders at build time

  ```json
  "options": {
    "outputMode": "static",
    "server": "src/main.server.ts",
    "ssr": { "entry": "src/server.ts" },
    "prerenderFormat": "file"
  }
  ```

  ✅ Works: prerendering without SSR

  ```json
  "options": {
    "server": "src/main.server.ts",
    "prerender": true,
    "prerenderFormat": "file"
  }
  ```

  ⚠️ Not considered, with a warning: a server is deployed

  ```json
  "options": {
    "outputMode": "server",
    "server": "src/main.server.ts",
    "ssr": { "entry": "src/server.ts" },
    "prerenderFormat": "file"
  }
  ```

  ⚠️ Not considered, with a warning: SSR without `outputMode` also deploys a server

  ```json
  "options": {
    "server": "src/main.server.ts",
    "ssr": { "entry": "src/server.ts" },
    "prerenderFormat": "file"
  }
  ```

- **`ng test` warning.** The `@angular/build:unit-test` builder logs a warning when its `buildTarget` uses a builder other than `@angular/build:application`. Tests run normally.

## 🏁 License <a name="license"></a>

Code released under the [MIT license](LICENSE).

[npm-url]: https://www.npmjs.com/package/@angular-schule/prerender-format
[npm-image]: https://badge.fury.io/js/@angular-schule%2Fprerender-format.svg
