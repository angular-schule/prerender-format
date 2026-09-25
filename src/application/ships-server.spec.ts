import { shipsServer } from './ships-server';

describe('shipsServer', () => {
  it('is true for outputMode server and for legacy SSR', () => {
    expect(shipsServer({ outputMode: 'server' })).toBe(true);
    expect(shipsServer({ ssr: true })).toBe(true);
    expect(shipsServer({ ssr: { entry: 'src/server.ts' } })).toBe(true);
  });

  it('is false for static builds, also with an SSR entry, and for builds without SSR', () => {
    expect(shipsServer({ outputMode: 'static', ssr: { entry: 'src/server.ts' } })).toBe(false);
    expect(shipsServer({ outputMode: 'static' })).toBe(false);
    expect(shipsServer({ ssr: false })).toBe(false);
    expect(shipsServer({})).toBe(false);
  });
});
