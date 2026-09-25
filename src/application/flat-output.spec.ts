import * as fs from 'fs';
import * as path from 'path';

import {
  flattenOutput,
  installFlatPrerender,
  PrerenderPages,
  toFlatPath,
  wrapPrerenderPages
} from './flat-output';

const angularBuildRoot = path.dirname(require.resolve('@angular/build/package.json'));

describe('toFlatPath', () => {
  it('maps nested index files to flat files', () => {
    expect(toFlatPath('blog/index.html')).toBe('blog.html');
    expect(toFlatPath('blog/my-article/index.html')).toBe('blog/my-article.html');
  });

  it('keeps the root index.html of a build (start page, locale start page)', () => {
    expect(toFlatPath('index.html')).toBe('index.html');
  });

  it('leaves other files untouched', () => {
    expect(toFlatPath('blog/feed.xml')).toBe('blog/feed.xml');
    expect(toFlatPath('blog/my-index.html')).toBe('blog/my-index.html');
  });
});

describe('flattenOutput', () => {
  const file = (content: string) => ({ content, appShellRoute: false });

  it('keeps parent and child routes side by side', () => {
    expect(
      flattenOutput({
        'index.html': file('home'),
        'blog/index.html': file('blog'),
        'blog/a/index.html': file('a')
      })
    ).toEqual({
      'index.html': file('home'),
      'blog.html': file('blog'),
      'blog/a.html': file('a')
    });
  });

  it('fails on colliding routes', () => {
    expect(() => flattenOutput({ 'foo/index.html': file('1'), 'foo.html': file('2') })).toThrow(
      /both map to 'foo.html'/
    );
  });
});

describe('wrapPrerenderPages', () => {
  it('flattens output and keeps the rest of the result', async () => {
    const original: PrerenderPages = async (...args) => ({
      errors: [],
      warnings: ['w'],
      output: { [`${args[0]}/index.html`]: { content: 'x', appShellRoute: false } }
    });

    expect(await wrapPrerenderPages(original)('about')).toEqual({
      errors: [],
      warnings: ['w'],
      output: { 'about.html': { content: 'x', appShellRoute: false } }
    });
  });

  it('fails loudly on an unknown result shape', async () => {
    const original = (async () => ({})) as unknown as PrerenderPages;

    await expect(wrapPrerenderPages(original)()).rejects.toThrow(/not supported/);
  });
});

describe('installFlatPrerender', () => {
  it('patches the module instance used by execute-post-bundle, once', () => {
    const prerender = require(path.join(angularBuildRoot, 'src/utils/server-rendering/prerender.js'));
    const original = prerender.prerenderPages;

    installFlatPrerender(angularBuildRoot);
    const patched = prerender.prerenderPages;
    installFlatPrerender(angularBuildRoot);

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
    expect(() => installFlatPrerender('/does/not/exist')).toThrow(/not supported/);
  });
});
