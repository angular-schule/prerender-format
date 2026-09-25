import * as fs from 'fs';
import * as path from 'path';

const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const sourceExists = (file: string) =>
  ['', '.ts', '.json'].some(ext => fs.existsSync(path.join(__dirname, file + ext)));

describe('package files', () => {
  it('builders.json points to existing files', () => {
    const { builders } = readJson('builders.json');

    for (const { implementation, schema } of Object.values<Record<string, string>>(builders)) {
      expect(sourceExists(implementation)).toBe(true);
      expect(sourceExists(schema)).toBe(true);
    }
  });

  it('collection.json points to existing files', () => {
    const { schematics } = readJson('collection.json');

    for (const { factory, schema } of Object.values<Record<string, string>>(schematics)) {
      expect(sourceExists(factory.split('#')[0])).toBe(true);
      expect(readJson(schema).type).toBe('object');
    }
  });

  it('package.json references builders and schematics', () => {
    const pkg = readJson('package.json');

    expect(pkg.builders).toBe('./builders.json');
    expect(pkg.schematics).toBe('./collection.json');
  });
});
