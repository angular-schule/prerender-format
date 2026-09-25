# @angular-schule/flat-prerender

[![NPM version][npm-image]][npm-url]
[![GitHub Actions](https://github.com/angular-schule/flat-prerender/actions/workflows/main.yml/badge.svg)](https://github.com/angular-schule/flat-prerender/actions/workflows/main.yml)
[![The MIT License](https://img.shields.io/badge/license-MIT-orange.svg?color=blue&style=flat-square)](http://opensource.org/licenses/MIT)

**Prerender your Angular app as `about.html` instead of `about/index.html`: no more trailing slash redirects! 🚀**

**Table of contents:**

1. [💡 Why?](#why)
2. [⚠️ Prerequisites](#prerequisites)
3. [🚀 Quick Start](#quickstart)
4. [⚙️ Installation](#installation)
5. [📦 Options](#options)
6. [🌍 Hosts](#hosts)
7. [🔧 How it works](#how-it-works)
8. [📁 Known limitations](#limitations)
9. [🏁 License](#license)

<hr>

## 💡 Why? <a name="why"></a>

Angular's prerendering (SSG) writes every route into its own folder: the route `blog/my-article` becomes `blog/my-article/index.html`.
Static hosts see a folder and redirect `/blog/my-article` to `/blog/my-article/`, and the Angular router then removes the trailing slash again.
Every direct visit (search engine, bookmark, shared link) starts with a redirect.

With this builder, the same route becomes `blog/my-article.html`.
Hosts like Cloudflare Pages serve that file under `/blog/my-article` directly, with status 200.

This is the option proposed in [angular/angular-cli#29173](https://github.com/angular/angular-cli/issues/29173).
As long as Angular has no built-in option, this builder provides it.

## ⚠️ Prerequisites <a name="prerequisites"></a>

- Angular 22 with the application builder (`@angular/build:application`)
- `"outputMode": "static"`
- A host that serves `foo.html` under `/foo` without a redirect (see [Hosts](#hosts))

## 🚀 Quick Start <a name="quickstart"></a>

```sh
ng add @angular-schule/flat-prerender
ng build
```

## ⚙️ Installation <a name="installation"></a>

`ng add @angular-schule/flat-prerender` installs the package and changes the build target in your `angular.json`:

```json
"build": {
  "builder": "@angular-schule/flat-prerender:application",
  "options": {
    "outputMode": "static",
    "prerenderOutputStyle": "flat"
  }
}
```

All other options stay as they are: the builder accepts every option of `@angular/build:application` and passes it on.
Use `--project` to choose the project in a workspace with several projects.

## 📦 Options <a name="options"></a>

#### prerenderOutputStyle

- **optional**
- Default: `directory`

| `prerenderOutputStyle` | Route `blog/my-article` | Start page |
|---|---|---|
| `directory` | `blog/my-article/index.html` | `index.html` |
| `flat` | `blog/my-article.html` | `index.html` |

Parent and child routes live side by side: `blog.html` next to the folder `blog/`.
The start page of each locale (for example with base href `/en/`) stays `index.html`.

## 🌍 Hosts <a name="hosts"></a>

Measured on **Cloudflare Pages** with a flat build:

| Request | Response |
|---|---|
| `/foo` | 200, `foo.html` |
| `/foo/` | 308 → `/foo` |
| `/foo.html` | 308 → `/foo` |
| `/foo` with `foo.html` next to the folder `foo/` | 200, `foo.html` |

Old addresses with a trailing slash keep working, they redirect to the address without it.

Other hosts (GitHub Pages, Firebase Hosting, Vercel, Netlify) are listed in the Angular issue as supporting this, some of them behind a setting.
Check your host before switching.

## 🔧 How it works <a name="how-it-works"></a>

The builder calls `buildApplication` from `@angular/build` and wraps its internal `prerenderPages()` function, which returns the prerendered pages as a record of output paths.
The wrapper renames `foo/index.html` to `foo.html` before anything is written, so the service worker manifest and all later build steps see the final file names.

`prerenderPages()` is internal API.
If a version of `@angular/build` changes it, the build fails with a clear error instead of silently writing `index.html` files.

## 📁 Known limitations <a name="limitations"></a>

- **Static builds only.** With `"outputMode": "server"` (or SSR without `outputMode`) the build fails, because the Angular SSR server looks up prerendered pages as `index.html`. An SSR entry that only renders at build time is fine.
- **`ng test` warning.** The `@angular/build:unit-test` builder logs a warning when its `buildTarget` uses a builder other than `@angular/build:application`. Tests run normally.

## 🏁 License <a name="license"></a>

Code released under the [MIT license](LICENSE).

[npm-url]: https://www.npmjs.com/package/@angular-schule/flat-prerender
[npm-image]: https://badge.fury.io/js/@angular-schule%2Fflat-prerender.svg
