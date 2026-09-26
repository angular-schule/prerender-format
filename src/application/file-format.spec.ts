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
      warnings: []
    });
  });

  it('keeps routes ending in index in any letter case as directories, with a warning', () => {
    const { output, warnings } = toFileOutput({
      'index.html': file('home'),
      'index/index.html': file('x'),
      'Index/index.html': file('y'),
      'docs/index/index.html': file('z')
    });

    expect(Object.keys(output)).toEqual(['index.html', 'index/index.html', 'Index/index.html', 'docs/index/index.html']);
    expect(warnings).toEqual([
      "Route '/index' is written to 'index/index.html' instead, because 'index.html' would be served for '/'.",
      "Route '/Index' is written to 'Index/index.html' instead, because 'Index.html' would be served for '/'.",
      "Route '/docs/index' is written to 'docs/index/index.html' instead, because 'docs/index.html' would be served for '/docs/'."
    ]);
  });

  it('keeps routes that would take over a reserved file as directories, with a warning', () => {
    const { output, warnings } = toFileOutput({ 'index.csr/index.html': file('x'), '404/index.html': file('y') }, ['index.csr.html', '404.html']);

    expect(Object.keys(output)).toEqual(['index.csr/index.html', '404/index.html']);
    expect(warnings).toEqual([
      "Route '/index.csr' is written to 'index.csr/index.html' instead, because 'index.csr.html' is used by the build itself.",
      "Route '/404' is written to '404/index.html' instead, because '404.html' is used by the build itself."
    ]);
  });

  it('keeps a route whose file name is already used as a directory, with a warning', () => {
    const { output, warnings } = toFileOutput({ 'Foo/index.html': file('1'), 'foo/index.html': file('2') }, []);

    expect(Object.keys(output)).toEqual(['Foo.html', 'foo/index.html']);
    expect(warnings).toEqual([
      "Route '/foo' is written to 'foo/index.html' instead, because 'foo.html' is already used by route '/Foo'."
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

  it('appends its warnings to the build warnings', async () => {
    const original: PrerenderPages = async () => ({
      errors: [],
      warnings: ['existing'],
      output: { 'index/index.html': { content: 'x', appShellRoute: false } }
    });

    const result = await wrapPrerenderPages(original)();

    expect(result.warnings).toEqual(['existing', expect.stringContaining("Route '/index'")]);
    expect(Object.keys(result.output)).toEqual(['index/index.html']);
  });

  it('passes an unknown result through unchanged', async () => {
    const unknown = { output: {} };
    const original = (async () => unknown) as unknown as PrerenderPages;
    const callsBefore = getPrerenderCalls();

    expect(await wrapPrerenderPages(original)()).toBe(unknown);
    expect(getPrerenderCalls()).toBe(callsBefore);
  });
});

describe('installFileFormat', () => {
  it('patches the module instance used by execute-post-bundle, once', () => {
    const prerender = require(path.join(angularBuildRoot, 'src/utils/server-rendering/prerender.js'));
    const original = prerender.prerenderPages;

    expect(installFileFormat(angularBuildRoot)).toEqual({ installed: true });
    const patched = prerender.prerenderPages;
    expect(installFileFormat(angularBuildRoot)).toEqual({ installed: true });

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
    expect(installFileFormat('/does/not/exist')).toEqual({
      installed: false,
      reason: expect.stringContaining('not supported')
    });
  });
});
