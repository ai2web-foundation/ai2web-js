// @ai2web/astro - Astro integration + endpoint factory for AI2Web.
//
// Two ways to use it:
//
// 1) Integration (auto-wires every route). In astro.config.mjs:
//
//      import ai2web from "@ai2web/astro";
//      export default defineConfig({
//        output: "server",                      // AI2Web routes are server-rendered
//        integrations: [ai2web({ entry: "./src/ai2web.config.ts" })],
//      });
//
//    where src/ai2web.config.ts default-exports { manifest, actions, ... }:
//
//      import { ai2web } from "@ai2web/core";
//      export default {
//        manifest: ai2web({ name: "Store", url: "https://store.example", type: "ecommerce" })
//          .capability("content").contact({ support: "help@store.example" }).build(),
//        actions: { track_order: (req) => track(req.body) },
//      };
//
// 2) Endpoint factory (manual wiring). In an endpoint file such as src/pages/ai2w/[...rest].ts:
//
//      import { createAi2wRoute } from "@ai2web/astro";
//      import options from "../../ai2web.config";
//      export const prerender = false;
//      export const ALL = createAi2wRoute(options);

import { fetchHandler, type Ai2wServerOptions } from "@ai2web/server";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type { Ai2wApiRoute, AstroIntegration } from "./types.js";

/** The routes AI2Web serves. `/ai2w/[...rest]` covers negotiate, modules and actions. */
const AI2W_ROUTE_PATTERNS = [
  "/ai2w",
  "/ai2w/[...rest]",
  "/.well-known/ai2w",
  "/.well-known/agent.json",
  "/agent.json",
  "/llms.txt",
];

/**
 * Build an Astro endpoint handler (assign to `export const ALL`) that serves AI2Web requests from
 * a manifest. Works with any Astro server/hybrid endpoint; Astro's `APIRoute` is assignable here.
 */
export function createAi2wRoute(opts: Ai2wServerOptions): Ai2wApiRoute {
  const handle = fetchHandler(opts);
  return (context) => handle(context.request);
}

export interface Ai2wAstroOptions {
  /**
   * Path (relative to the Astro project root) to a module that default-exports
   * `Ai2wServerOptions` - `{ manifest, actions?, modules?, ... }`. Defaults to
   * `./src/ai2web.config`.
   */
  entry?: string;
}

/**
 * Astro integration that injects the AI2Web routes and serves them from your config module.
 * Requires an SSR/hybrid output (the routes are server-rendered). Non-AI2Web routes are untouched.
 */
export default function ai2web(options: Ai2wAstroOptions = {}): AstroIntegration {
  const entry = options.entry ?? "./src/ai2web.config";
  return {
    name: "@ai2web/astro",
    hooks: {
      "astro:config:setup": ({ config, injectRoute, updateConfig }) => {
        const root = fileURLToPath(config.root);
        const configPath = resolve(root, entry);
        // Point the shipped route entrypoint's `virtual:ai2web/user-config` import at the user's
        // config module, so the injected routes serve from the real manifest + actions.
        updateConfig({ vite: { resolve: { alias: { "virtual:ai2web/user-config": configPath } } } });
        for (const pattern of AI2W_ROUTE_PATTERNS) {
          injectRoute({ pattern, entrypoint: "@ai2web/astro/route", prerender: false });
        }
      },
    },
  };
}

export type { Ai2wApiRoute, AstroIntegration } from "./types.js";
export type { Ai2wServerOptions } from "@ai2web/server";
