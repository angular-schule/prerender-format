'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const {
  toFlatPath,
  flattenOutput,
  wrapPrerenderPages,
  installFlatPrerender,
} = require('../src/flat-output');

test('toFlatPath maps nested index files to flat files', () => {
  assert.equal(toFlatPath('blog/index.html'), 'blog.html');
  assert.equal(toFlatPath('blog/my-article/index.html'), 'blog/my-article.html');
});

test('toFlatPath keeps the root index.html of a build (start page, locale start page)', () => {
  assert.equal(toFlatPath('index.html'), 'index.html');
});

test('toFlatPath leaves other files untouched', () => {
  assert.equal(toFlatPath('blog/feed.xml'), 'blog/feed.xml');
  assert.equal(toFlatPath('blog/my-index.html'), 'blog/my-index.html');
});

test('flattenOutput keeps parent and child routes side by side', () => {
  const output = flattenOutput({
    'index.html': { content: 'home' },
    'blog/index.html': { content: 'blog' },
    'blog/a/index.html': { content: 'a' },
  });

  assert.deepEqual(output, {
    'index.html': { content: 'home' },
    'blog.html': { content: 'blog' },
    'blog/a.html': { content: 'a' },
  });
});

test('flattenOutput fails on colliding routes', () => {
  assert.throws(
    () => flattenOutput({ 'foo/index.html': { content: '1' }, 'foo.html': { content: '2' } }),
    /both map to 'foo.html'/,
  );
});

test('wrapPrerenderPages flattens output and keeps the rest of the result', async () => {
  const original = async (route) => ({
    errors: [],
    warnings: ['w'],
    output: { [`${route}/index.html`]: { content: 'x', appShellRoute: false } },
  });
  const result = await wrapPrerenderPages(original)('about');

  assert.deepEqual(result, {
    errors: [],
    warnings: ['w'],
    output: { 'about.html': { content: 'x', appShellRoute: false } },
  });
});

test('wrapPrerenderPages fails loudly on an unknown result shape', async () => {
  await assert.rejects(() => wrapPrerenderPages(async () => ({}))(), /not supported/);
});

test('installFlatPrerender patches the module instance used by execute-post-bundle', () => {
  const root = path.dirname(require.resolve('@angular/build/package.json'));
  const prerender = require(path.join(root, 'src/utils/server-rendering/prerender.js'));
  const original = prerender.prerenderPages;

  installFlatPrerender(root);
  const patched = prerender.prerenderPages;
  installFlatPrerender(root);

  assert.notEqual(patched, original);
  assert.equal(prerender.prerenderPages, patched, 'installing twice wraps only once');

  const source = require('node:fs').readFileSync(
    path.join(root, 'src/builders/application/execute-post-bundle.js'),
    'utf8',
  );
  assert.match(
    source,
    /\(0, prerender_1\.prerenderPages\)\(/,
    'execute-post-bundle reads prerenderPages from the exports object at call time',
  );
});

test('installFlatPrerender rejects an unsupported @angular/build layout', () => {
  assert.throws(() => installFlatPrerender('/does/not/exist'), /not supported/);
});
