// Example: serve AI2Web from a Cloudflare Worker.
//   wrangler dev   (or)   wrangler deploy   using wrangler.example.toml
//
// "Describe your website once" - the manifest is built with the fluent builder,
// and cloudflareHandler serves /ai2w, /.well-known/ai2w, /ai2w/negotiate and modules.

import { ai2web } from "@ai2web/core";
import { cloudflareHandler } from "@ai2web/server";

const manifest = ai2web({ name: "Example on Cloudflare", url: "https://example.workers.dev", type: "content" })
  .capability("content", { endpoint: "/ai2w/content" })
  .capability("search", { endpoint: "/ai2w/search" })
  .transports({ rest: { enabled: true, base: "/ai2w" }, mcp: { enabled: true, endpoint: "/ai2w/mcp" } })
  .contact({ support: "hi@example.com" })
  .build();

export default cloudflareHandler({
  manifest,
  modules: {
    content: () => [
      { title: "Hello from AI2Web on Cloudflare", url: "https://example.workers.dev/hello", type: "page" },
    ],
    search: (req) => {
      const q = typeof req.body === "object" && req.body ? (req.body as { query?: string }).query ?? "" : "";
      return { query: q, results: [] };
    },
  },
});
