<div align="center">
  <a href="https://ai2web.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/ai2web-foundation/.github/main/profile/ai2web-logo-white.svg">
      <img alt="AI2Web" src="https://raw.githubusercontent.com/ai2web-foundation/.github/main/profile/ai2web-logo-black.svg" width="200">
    </picture>
  </a>
</div>

# AI2Web JavaScript/TypeScript framework (`@ai2web/*`)

[![CI](https://github.com/ai2web-foundation/ai2web-js/actions/workflows/ci.yml/badge.svg)](https://github.com/ai2web-foundation/ai2web-js/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@ai2web/core?label=%40ai2web%2Fcore)](https://www.npmjs.com/package/@ai2web/core)

The reference framework for the [AI2Web protocol](https://github.com/ai2web-foundation/ai2web-spec). Describe your website's capabilities once; generate the manifest, routes, and adapters.

**TypeScript, JavaScript, or React.** The packages are authored in TypeScript but published as standard ESM JavaScript with bundled type declarations, so they run unchanged in plain JS. `@ai2web/react` adds hooks and an embeddable badge for React apps, and a framework-free `<ai2w-badge>` web component works in any HTML page with no build step. See [`examples/`](examples/).

## Packages

| Package | Status | Purpose |
|---|---|---|
| `@ai2web/core` | ✅ scaffolded | Types, capability model, fluent manifest **builder**, **validation** + AI Readiness scoring, **discovery** client, **export** projections (`toLlmsTxt` / `toAgentJson`, RFC-0015), and the shared **`executeOperation`** guard (RFC-0006 §3: approval by risk tier, same-origin credentials, SSRF) that every adapter routes through. |
| `@ai2web/validator` | ✅ scaffolded | `ai2web validate <url>` CLI → per-capability report + AI Readiness Score + tier. |
| `@ai2web/server` | ✅ scaffolded | Framework-agnostic `/ai2w`, `/ai2w/*`, negotiation and action route handler, plus multi-surface projections (`/llms.txt`, `/.well-known/agent.json`, RFC-0015); **Cloudflare Workers** and **Node** adapters. |
| `@ai2web/mcp-bridge` | ✅ scaffolded | Expose declared capabilities as an MCP server (usable in Claude/ChatGPT today). |
| `@ai2web/graphql-adapter` | ✅ scaffolded | Project the declared model as a GraphQL schema (SDL + resolvers); GET actions become Query fields, writes become Mutations. |
| `@ai2web/acp-adapter` | ✅ scaffolded | Drive a site's advertised **ACP** checkout transport (RFC-0005 Profile 1); the payment step stays approval-gated. |
| `@ai2web/ap2-adapter` | ✅ scaffolded | Drive a site's advertised **AP2** (Agent Payments Protocol) merchant transport: create a signed Cart Mandate, settle a Payment Mandate; the payment step stays approval-gated. |
| `@ai2web/openapi-adapter` | ✅ scaffolded | Describe the declared actions as an **OpenAPI 3.1** document; auth becomes security, risk/approval become `x-ai2w-*` extensions. |
| `@ai2web/connector` | ✅ scaffolded | Agent-side connector: one MCP server that fronts the Discovery Network and acts on sites. |
| `@ai2web/react` | ✅ scaffolded | React bindings: `useDiscover` / `useValidate` / `useNegotiate` hooks and an embeddable `<Ai2wBadge>`. React is an optional peer dependency. |
| `@ai2web/hono` | ✅ scaffolded | Hono middleware: `app.use("*", ai2w({ manifest, actions }))` serves every AI2Web route and passes the rest through. Edge-native (Workers/Bun/Deno). |
| `@ai2web/astro` | ✅ scaffolded | Astro integration (auto-wires the routes) + a `createAi2wRoute` endpoint factory. Serves from your manifest under SSR/hybrid output. |
| `@ai2web/nuxt` | ✅ scaffolded | Nuxt module: add `"@ai2web/nuxt"` and point it at your config module; it registers the Nitro server routes for every AI2Web path. |

The executing adapters (MCP, GraphQL, ACP) derive their surface from the same manifest and run through the one `executeOperation` in `@ai2web/core`, so none can expose an undeclared capability or drift on the security contract; the OpenAPI adapter is descriptive but likewise describes only declared actions and preserves their auth/risk semantics. Conformance is enforced in CI by [`scripts/adapter-conformance.ts`](scripts/adapter-conformance.ts) (MCP), [`scripts/adapter-graphql-acp.ts`](scripts/adapter-graphql-acp.ts) (GraphQL + ACP), and [`scripts/adapter-openapi.ts`](scripts/adapter-openapi.ts) (OpenAPI).

## Try the validator now (zero-dependency)

Before the TypeScript build, a runnable mirror lives at [`scripts/validate.mjs`](scripts/validate.mjs):

```bash
node scripts/validate.mjs ../ai2web-spec/examples/ecommerce.json   # → AI Readiness Score 100/100
node scripts/validate.mjs https://some-site.com                    # fetches /ai2w with well-known fallback
```

## Describe a site once (builder)

```ts
import { ai2web } from "@ai2web/core";

const manifest = ai2web({ name: "Example Store", url: "https://example.com", type: "ecommerce" })
  .capability("content")
  .capability("commerce", { endpoint: "/ai2w/products", checkout: true })
  .transports({ mcp: { enabled: true, endpoint: "/ai2w/mcp" }, rest: { enabled: true, base: "/ai2w" } })
  .auth({ methods: ["none", "oauth2"], oauth2: { pkce: true, scopes: ["read_products", "checkout"] } })
  .consent({ requires_user_approval_for: ["purchase", "payment"] })
  .events({ endpoint: "/ai2w/events", types: ["order.shipped", "price.drop"] })
  .build();
```

## Build (once dependencies are installed)

```bash
npm install
npm run build          # tsc --build across workspaces
```

## Licence

MIT.
