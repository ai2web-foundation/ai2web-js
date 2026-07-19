// @ai2web/nuxt - Nuxt module for AI2Web.
//
// In nuxt.config.ts:
//
//   export default defineNuxtConfig({
//     modules: ["@ai2web/nuxt"],
//     ai2web: { config: "ai2web.config" },   // path (relative to srcDir) to your config module
//   });
//
// and ai2web.config.ts (default-exports Ai2wServerOptions):
//
//   import { ai2web } from "@ai2web/core";
//   export default {
//     manifest: ai2web({ name: "Store", url: "https://store.example", type: "ecommerce" })
//       .capability("content").contact({ support: "help@store.example" }).build(),
//     actions: { track_order: (req) => track(req.body) },
//   };
//
// The module registers Nitro server routes for every AI2Web path; all other routes are untouched.

import { defineNuxtModule, createResolver, addServerHandler, type NuxtLike } from "@nuxt/kit";
import { resolve as resolvePath } from "node:path";

export interface Ai2wNuxtOptions {
  /**
   * Path to a module that default-exports `Ai2wServerOptions` (`{ manifest, actions?, ... }`).
   * A bare/relative path is resolved against the Nuxt `srcDir`. Defaults to `ai2web.config`.
   */
  config?: string;
}

/** The AI2Web routes to register. `/ai2w/**` covers negotiate, modules and actions. */
const AI2W_ROUTES = ["/ai2w", "/ai2w/**", "/.well-known/ai2w", "/.well-known/agent.json", "/agent.json", "/llms.txt"];

export default defineNuxtModule<Ai2wNuxtOptions>({
  meta: { name: "@ai2web/nuxt", configKey: "ai2web", compatibility: { nuxt: ">=3.0.0" } },
  defaults: {},
  setup(options: Ai2wNuxtOptions, nuxt: NuxtLike) {
    const { resolve } = createResolver(import.meta.url);
    const handler = resolve("./runtime/server/handler");

    // Point the runtime handler's `#ai2web/config` import at the user's config module.
    const entry = options.config ?? "ai2web.config";
    const configPath = /^([./]|[a-zA-Z]:)/.test(entry) ? resolvePath(nuxt.options.srcDir, entry) : entry;
    nuxt.options.nitro = nuxt.options.nitro || {};
    nuxt.options.nitro.alias = nuxt.options.nitro.alias || {};
    nuxt.options.nitro.alias["#ai2web/config"] = configPath;

    for (const route of AI2W_ROUTES) addServerHandler({ route, handler });
  },
});

export type { Ai2wServerOptions } from "@ai2web/server";
