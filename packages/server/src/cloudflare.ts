// Cloudflare Workers adapter for the AI2Web handler.
// Because the core handler is framework-agnostic (Ai2wRequest -> Ai2wResponse),
// this maps the Workers Request/Response types with ~20 lines.
//
//   // worker.ts
//   import { cloudflareHandler } from "@ai2web/server/cloudflare";
//   export default cloudflareHandler({ manifest, modules, actions });

import { createAi2wHandler, type Ai2wServerOptions } from "./handler.js";

export function cloudflareHandler(opts: Ai2wServerOptions): { fetch(request: Request): Promise<Response> } {
  const handle = createAi2wHandler(opts);
  return {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      let body: unknown;
      if (["POST", "PUT", "PATCH"].includes(request.method)) {
        const text = await request.text();
        body = text ? safeJson(text) : undefined;
      }
      const res = await handle({ method: request.method, path: url.pathname, body, origin: url.origin });
      const out = res.body === null ? "" : res.raw ? String(res.body) : JSON.stringify(res.body);
      return new Response(out, { status: res.status, headers: res.headers });
    },
  };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
