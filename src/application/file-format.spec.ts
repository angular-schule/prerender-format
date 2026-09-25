import * as fs from 'fs';
import * as path from 'path';

import {
  toFileOutput,
  getPrerenderCalls,
  installFileFormat,
  PrerenderPages,
  toFilePath,
  wrapPrerenderPages
} from './file-format';

const angularBuildRoot = path.dirname(require.resolve('@angular/build/package.json'));

describe('toFilePath', () => {
  it('maps nested index files to .html files', () => {
    expect(toFilePath('blog/index.html')).toBe('blog.html');
    expect(toFilePath('blog/my-article/index.html')).toBe('blog/my-article.html');
  });

  it('keeps the root index.html of a build (start page, locale start page)', () => {
    expect(toFilePath('index.html')).toBe('index.html');
  });

  it('leaves other files untouched', () => {
    expect(toFilePath('blog/feed.xml')).toBe('blog/feed.xml');
    expect(toFilePath('blog/my-index.html')).toBe('blog/my-index.html');
  });
});

describe('toFileOutput', () => {
  const file = (content: string) => ({ content, appShellRoute: false });

  it('keeps parent and child routes side by side', () => {
    expect(
      toFileOutput({
        'index.html': file('home'),
        'blog/index.html': file('blog'),
        'blog/a/index.html': file('a')
      })
    ).toEqual({
      output: {
        'index.html': file('home'),
        'blog.html': file('blog'),
        'blog/a.html': file('a')
      },
      errors: []
    });
  });

  it('reports the route /index, which would overwrite the start page', () => {
    const { errors } = toFileOutput({ 'index.html': file('home'), 'index/index.html': file('x') });

    expect(errors).toEqual([expect.stringContaining("Route '/index' cannot be prerendered")]);
    expect(errors[0]).toContain("would be served as '/'");
  });

  it('reports nested routes ending in index', () => {
    const { errors } = toFileOutput({ 'docs/index/index.html': file('x') });

    expect(errors).toEqual([expect.stringContaining("Route '/docs/index' cannot be prerendered")]);
    expect(errors[0]).toContain("would be served as '/docs/'");
  });

  it('reports colliding routes', () => {
    const { errors } = toFileOutput({ 'foo/index.html': file('1'), 'foo.html': file('2') });

    expect(errors).toEqual([
      "Routes '/foo' and '/foo.html' both map to the file 'foo.html' with 'prerenderFormat: \"file\"'."
    ]);
  });
});

describe('wrapPrerenderPages', () => {
  it('renames output, keeps the rest of the result and counts the call', async () => {
    const original: PrerenderPages = async (...args) => ({
      errors: [],
      warnings: ['w'],
      output: { [`${args[0]}/index.html`]: { content: 'x', appShellRoute: false } }
    });
    const callsBefore = getPrerenderCalls();

    expect(await wrapPrerenderPages(original)('about')).toEqual({
      errors: [],
      warnings: ['w'],
      output: { 'about.html': { content: 'x', appShellRoute: false } }
    });
    expect(getPrerenderCalls()).toBe(callsBefore + 1);
  });

  it('appends its errors to the build errors', async () => {
    const original: PrerenderPages = async () => ({
      errors: ['existing'],
      output: { 'index/index.html': { content: 'x', appShellRoute: false } }
    });

    const result = await wrapPrerenderPages(original)();

    expect(result.errors).toEqual(['existing', expect.stringContaining("Route '/index'")]);
  });

  it('fails loudly on an unknown result shape', async () => {
    const original = (async () => ({ output: {} })) as unknown as PrerenderPages;

    await expect(wrapPrerenderPages(original)()).rejects.toThrow(/not supported/);
  });
});

describe('installFileFormat', () => {
  it('patches the module instance used by execute-post-bundle, once', () => {
    const prerender = require(path.join(angularBuildRoot, 'src/utils/server-rendering/prerender.js'));
    const original = prerender.prerenderPages;

    installFileFormat(angularBuildRoot);
    const patched = prerender.prerenderPages;
    installFileFormat(angularBuildRoot);

    expect(patched).not.toBe(original);
    expect(prerender.prerenderPages).toBe(patched);
  });

  it('relies on execute-post-bundle reading prerenderPages from the exports object at call time', () => {
    const source = fs.readFileSync(
      path.join(angularBuildRoot, 'src/builders/application/execute-post-bundle.js'),
      'utf8'
    );

    expect(source).toMatch(/\(0, prerender_1\.prerenderPages\)\(/);
  });

  it('rejects an unsupported @angular/build layout', () => {
    expect(() => installFileFormat('/does/not/exist')).toThrow(/not supported/);
  });
});
