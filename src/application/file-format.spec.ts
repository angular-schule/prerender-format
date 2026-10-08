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
      'index.html': file('home'),
      'blog.html': file('blog'),
      'blog/a.html': file('a')
    });
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
