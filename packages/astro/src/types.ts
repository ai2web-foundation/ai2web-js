// Minimal structural types for the slice of Astro's integration + endpoint API this package uses.
// Declared locally so @ai2web/astro needs no build-time dependency on `astro` itself (it stays a
// peer dependency). They intentionally match Astro's public shapes; `astro`'s own richer types are
// assignable to these at the call sites.

/** The context Astro passes to an endpoint handler. Only `request` is used here. */
export interface Ai2wApiContext {
  request: Request;
}

/** An Astro endpoint handler (e.g. `export const ALL = ...`). */
export type Ai2wApiRoute = (context: Ai2wApiContext) => Response | Promise<Response>;

export interface InjectRouteParams {
  pattern: string;
  entrypoint: string;
  prerender?: boolean;
}

export interface AstroConfigSetupParams {
  config: { root: URL };
  injectRoute: (route: InjectRouteParams) => void;
  updateConfig: (config: Record<string, unknown>) => void;
  logger?: { info: (msg: string) => void };
}

export interface AstroIntegration {
  name: string;
  hooks: {
    "astro:config:setup"?: (params: AstroConfigSetupParams) => void | Promise<void>;
  } & Record<string, unknown>;
}
