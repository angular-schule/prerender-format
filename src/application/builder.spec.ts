import { toApplicationOptions } from './builder';

describe('toApplicationOptions', () => {
  it('uses the "directory" format without a prerender object', () => {
    expect(toApplicationOptions({ prerender: true } as never)).toEqual({
      applicationOptions: { prerender: true },
      format: 'directory',
      prerenderIgnored: false
    });
  });

  it('removes the format from the prerender options of a build without outputMode', () => {
    expect(toApplicationOptions({ prerender: { format: 'file', discoverRoutes: true } } as never)).toEqual({
      applicationOptions: { prerender: { discoverRoutes: true } },
      format: 'file',
      prerenderIgnored: false
    });
  });

  it('drops the prerender option with outputMode and keeps the format', () => {
    expect(
      toApplicationOptions({
        outputMode: 'static',
        server: 'src/main.server.ts',
        prerender: { format: 'file', discoverRoutes: true }
      } as never)
    ).toEqual({
      applicationOptions: { outputMode: 'static', server: 'src/main.server.ts' },
      format: 'file',
      prerenderIgnored: false
    });
  });

  it.each([
    ['routesFile', { format: 'file', routesFile: 'routes.txt', discoverRoutes: true }],
    ['discoverRoutes: false', { format: 'file', discoverRoutes: false }],
    ['true', true],
    ['false', false]
  ])('reports prerender with %s as ignored with outputMode', (_, prerender) => {
    expect(toApplicationOptions({ outputMode: 'static', server: 'src/main.server.ts', prerender } as never)).toEqual({
      applicationOptions: { outputMode: 'static', server: 'src/main.server.ts' },
      format: typeof prerender === 'object' ? 'file' : 'directory',
      prerenderIgnored: true
    });
  });
});
