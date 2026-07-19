// @ai2web/hono - Hono middleware for AI2Web.
//
// Hono runs on Cloudflare Workers, Bun, Deno, Node and the edge, so one manifest becomes
// agent-ready everywhere Hono runs. The middleware handles the AI2Web routes and calls next()
// for everything else, so it composes with the rest of your app.
//
//   import { Hono } from "hono";
//   import { ai2w } from "@ai2web/hono";
//
//   const app = new Hono();
//   app.use("*", ai2w({ manifest, actions: { track_order: (req) => track(req.body) } }));
//   // now serves GET /ai2w, /.well-known/ai2w, /llms.txt, /agent.json,
//   // POST /ai2w/negotiate, /ai2w/{module}, /ai2w/actions/{name}

import { fetchHandler, isAi2wPath, type Ai2wServerOptions } from "@ai2web/server";
import type { Context, MiddlewareHandler, Next } from "hono";

/**
 * Hono middleware that serves every AI2Web route from a single manifest and passes all other
 * requests through to the next handler. Mount it once with `app.use("*", ai2w(opts))`.
 */
export function ai2w(opts: Ai2wServerOptions): MiddlewareHandler {
  const handle = fetchHandler(opts);
  return async (c: Context, next: Next): Promise<Response | void> => {
    if (!isAi2wPath(new URL(c.req.url).pathname)) return next();
    return handle(c.req.raw);
  };
}

export default ai2w;
export type { Ai2wServerOptions } from "@ai2web/server";
