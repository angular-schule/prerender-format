// Writes application/schema.json: the schema of @angular/build:application plus `prerender.format`.
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

schema.$id = 'AngularSchulePrerenderFormatApplicationSchema';
schema.title = `Application builder with prerender.format (based on @angular/build ${version})`;

const prerenderObject = schema.properties.prerender.oneOf.find((variant) => variant.type === 'object');
prerenderObject.properties.format = {
  type: 'string',
  description:
    "Defines the file layout of prerendered pages. 'directory': '/foo' is written to 'foo/index.html'. " +
    "'file': '/foo' is written to 'foo.html', which some hosting services serve for '/foo' without a redirect to '/foo/'. " +
    "The root route of the application and of each locale is always written to 'index.html'. " +
    'Only considered when the build does not produce a server.',
  enum: ['directory', 'file'],
  default: 'directory',
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
