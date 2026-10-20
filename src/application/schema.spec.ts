import { schema } from '@angular-devkit/core';
import * as fs from 'fs';
import * as path from 'path';

const applicationSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));

/** Validates `prerender` as `ng build` does for this builder, including the schema defaults. */
async function validatePrerender(prerender: unknown): Promise<{ success: boolean; prerender: unknown }> {
  const registry = new schema.CoreSchemaRegistry();
  registry.addPostTransform(schema.transforms.addUndefinedDefaults);
  const validator = await registry.compile(applicationSchema);
  const { success, data } = await validator({ tsConfig: 'tsconfig.app.json', prerender } as never);

  return { success, prerender: (data as { prerender: unknown }).prerender };
}

describe('application/schema.json', () => {
  it('accepts an object with format', async () => {
    expect(await validatePrerender({ format: 'file' })).toEqual({ success: true, prerender: { format: 'file' } });
  });

  it.each([{}, { routesFile: 'routes.txt' }, { discoverRoutes: false }])(
    'keeps %o an object of @angular/build, without format',
    async prerender => {
      const result = await validatePrerender(prerender);

      expect(result.success).toBe(true);
      expect(Object.keys(result.prerender as object)).not.toContain('format');
    }
  );

  it.each([
    { format: 'file', routesFile: 'routes.txt' },
    { format: 'file', discoverRoutes: false }
  ])('rejects format together with the settings of @angular/build: %o', async prerender => {
    expect((await validatePrerender(prerender)).success).toBe(false);
  });
});
