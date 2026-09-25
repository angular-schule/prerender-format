// Writes application/schema.json: the schema of @angular/build:application plus `prerenderOutputStyle`.
// `node scripts/build-schema.mjs --check` fails if application/schema.json is not in sync with the installed @angular/build.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const target = new URL('../application/schema.json', import.meta.url);

// The exports map of @angular/build hides the schema, so it is read via the package directory.
const packageJsonPath = require.resolve('@angular/build/package.json');
const { version } = require(packageJsonPath);
const schema = JSON.parse(
  readFileSync(join(dirname(packageJsonPath), 'src/builders/application/schema.json'), 'utf8'),
);

schema.$id = 'AngularSchuleFlatPrerenderApplicationSchema';
schema.title = `Application builder with flat prerender output (based on @angular/build ${version})`;
schema.properties.prerenderOutputStyle = {
  type: 'string',
  enum: ['directory', 'flat'],
  default: 'directory',
  description:
    "File layout of prerendered routes. 'directory' writes 'foo/index.html', which works on every web server. " +
    "'flat' writes 'foo.html' (the start page stays 'index.html'). Only use 'flat' if your host serves 'foo.html' under '/foo' " +
    "without a redirect, for example GitHub Pages or Cloudflare Pages. Requires 'outputMode: \"static\"'.",
};

const content = JSON.stringify(schema, null, 2) + '\n';

if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== content) {
    console.error(`application/schema.json is out of sync with @angular/build ${version}. Run: npm run build:schema`);
    process.exit(1);
  }
  console.log(`application/schema.json matches @angular/build ${version}.`);
} else {
  writeFileSync(target, content);
  console.log(`application/schema.json written from @angular/build ${version}.`);
}
