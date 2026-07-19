// Cloudflare Workers adapter for the AI2Web handler.
// The core handler is framework-agnostic (Ai2wRequest -> Ai2wResponse) and `fetchHandler` maps it
// to the Web Fetch Request/Response that Workers speak, so this is a one-line wrapper.
//
//   // worker.ts
//   import { cloudflareHandler } from "@ai2web/server/cloudflare";
//   export default cloudflareHandler({ manifest, modules, actions });

import { fetchHandler, type Ai2wServerOptions } from "./handler.js";

export function cloudflareHandler(opts: Ai2wServerOptions): { fetch(request: Request): Promise<Response> } {
  return { fetch: fetchHandler(opts) };
}
