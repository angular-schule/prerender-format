/**
 * Whether a build with these options ships an Angular SSR server.
 * With `outputMode: "static"` the SSR entry only renders at build time.
 * Without `outputMode`, an `ssr` option builds a server (legacy SSR).
 */
export function shipsServer(options: { outputMode?: unknown; ssr?: unknown }): boolean {
  return options.outputMode === 'server' || (options.outputMode === undefined && !!options.ssr);
}
