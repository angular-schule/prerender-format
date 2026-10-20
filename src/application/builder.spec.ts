import { toApplicationOptions } from './builder';

describe('toApplicationOptions', () => {
  it('uses the "directory" format without a prerender object', () => {
    expect(toApplicationOptions({ prerender: true } as never)).toEqual({
      applicationOptions: { prerender: true },
      format: 'directory',
      prerenderIgnored: false
    });
  });

  it('removes the format from the prerender option of a build without outputMode', () => {
    expect(toApplicationOptions({ prerender: { format: 'file' } } as never)).toEqual({
      applicationOptions: { prerender: {} },
      format: 'file',
      prerenderIgnored: false
    });
  });

  it('passes the prerender settings of @angular/build through without outputMode', () => {
    expect(toApplicationOptions({ prerender: { routesFile: 'routes.txt', discoverRoutes: true } } as never)).toEqual({
      applicationOptions: { prerender: { routesFile: 'routes.txt', discoverRoutes: true } },
      format: 'directory',
      prerenderIgnored: false
    });
  });

  it('drops the prerender option with outputMode and keeps the format', () => {
    expect(
      toApplicationOptions({
        outputMode: 'static',
        server: 'src/main.server.ts',
        prerender: { format: 'file' }
      } as never)
    ).toEqual({
      applicationOptions: { outputMode: 'static', server: 'src/main.server.ts' },
      format: 'file',
      prerenderIgnored: false
    });
  });

  it.each([
    ['routesFile', { routesFile: 'routes.txt', discoverRoutes: true }],
    ['discoverRoutes: false', { discoverRoutes: false }],
    ['discoverRoutes: true', { discoverRoutes: true }],
    ['true', true],
    ['false', false]
  ])('reports prerender with %s as ignored with outputMode', (_, prerender) => {
    expect(toApplicationOptions({ outputMode: 'static', server: 'src/main.server.ts', prerender } as never)).toEqual({
      applicationOptions: { outputMode: 'static', server: 'src/main.server.ts' },
      format: 'directory',
      prerenderIgnored: true
    });
  });
});
