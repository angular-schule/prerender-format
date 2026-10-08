import { toApplicationOptions } from './builder';

describe('toApplicationOptions', () => {
  it('uses the "directory" format without a prerender object', () => {
    expect(toApplicationOptions({ outputMode: 'static', prerender: true } as never)).toEqual({
      applicationOptions: { outputMode: 'static', prerender: true },
      format: 'directory'
    });
  });

  it('removes the format from the prerender options of a build without outputMode', () => {
    expect(toApplicationOptions({ prerender: { format: 'file', discoverRoutes: true } } as never)).toEqual({
      applicationOptions: { prerender: { discoverRoutes: true } },
      format: 'file'
    });
  });

  it('drops a prerender object that only carries the format when outputMode prerenders pages', () => {
    expect(
      toApplicationOptions({
        outputMode: 'static',
        server: 'src/main.server.ts',
        prerender: { format: 'file', discoverRoutes: true }
      } as never)
    ).toEqual({
      applicationOptions: { outputMode: 'static', server: 'src/main.server.ts', prerender: undefined },
      format: 'file'
    });
  });

  it('keeps the other prerender options with outputMode, so that @angular/build warns about them', () => {
    expect(
      toApplicationOptions({
        outputMode: 'static',
        server: 'src/main.server.ts',
        prerender: { format: 'file', routesFile: 'routes.txt' }
      } as never)
    ).toEqual({
      applicationOptions: {
        outputMode: 'static',
        server: 'src/main.server.ts',
        prerender: { routesFile: 'routes.txt' }
      },
      format: 'file'
    });
  });
});
