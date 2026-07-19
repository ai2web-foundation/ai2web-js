// Framework adapters (Hono / Astro / Nuxt) verification. They all wrap the same framework-agnostic
// AI2Web handler via the shared `fetchHandler` (Web Request -> Response), so these checks prove the
// shared core, the real Hono middleware (pass-through + interception), and the Astro route factory.
// The Nuxt module/runtime share the very same `fetchHandler`, exercised here directly.
//
// Runs after `npm install` + `npm run build` (bare "@ai2web/*" specifiers resolve to built dist),
// like scripts/test-server.ts. Run: node --experimental-strip-types scripts/adapter-frameworks.ts

import { fetchHandler, isAi2wPath } from "../packages/server/src/handler.ts";
import { ai2web } from "../packages/core/src/builder.ts";
import { ai2w as honoAi2w } from "../packages/hono/src/index.ts";
import { createAi2wRoute } from "../packages/astro/src/index.ts";
import { Hono } from "hono";

let fails = 0;
const check = (cond: boolean, label: string, detail?: unknown) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) { fails++; if (detail !== undefined) console.log("      got:", JSON.stringify(detail)); }
};

const manifest = ai2web({ name: "Store", url: "https://store.example", type: "ecommerce" })
  .capability("content")
  .capability("search", { endpoint: "/ai2w/search" })
  .action({
    name: "track_order", description: "Track an order.", method: "POST",
    endpoint: "/ai2w/actions/track-order", requires_auth: false, requires_user_approval: false, risk: "low",
    input_schema: { type: "object", properties: { order_id: { type: "string" } }, required: ["order_id"] },
  })
  .contact({ support: "help@store.example" })
  .build();

const actions = { track_order: (req: { body?: { order_id?: string } }) => ({ ok: true, order_id: req.body?.order_id }) };
const opts = { manifest, actions };
const jsonReq = (url: string, obj: unknown) =>
  new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });

// --- isAi2wPath: intercept only AI2Web routes ---
for (const p of ["/ai2w", "/ai2w/", "/.well-known/ai2w", "/llms.txt", "/agent.json", "/.well-known/agent.json", "/ai2w/negotiate", "/ai2w/actions/track-order", "/ai", "/.ai"])
  check(isAi2wPath(p), `isAi2wPath true for ${p}`);
for (const p of ["/", "/about", "/api/products", "/ai2web", "/well-known/ai2w"])
  check(!isAi2wPath(p), `isAi2wPath false for ${p}`);

// --- shared fetchHandler (the heart of all three adapters) ---
{
  const handle = fetchHandler(opts);
  const manifestRes = await handle(new Request("https://store.example/ai2w"));
  check(manifestRes.status === 200 && (await manifestRes.clone().json()).protocol === "ai2w", "fetchHandler: GET /ai2w -> manifest");

  const wk = await handle(new Request("https://store.example/.well-known/ai2w"));
  check((await wk.json()).ai2w === "https://store.example/ai2w", "fetchHandler: well-known -> pointer with origin from URL");

  const llms = await handle(new Request("https://store.example/llms.txt"));
  check(llms.status === 200 && (llms.headers.get("content-type") ?? "").startsWith("text/plain") && (await llms.text()).startsWith("#"), "fetchHandler: /llms.txt is text/plain");

  const ok = await handle(jsonReq("https://store.example/ai2w/actions/track-order", { order_id: "A1" }));
  const okBody = await ok.json();
  check(ok.status === 200 && okBody.ok === true && okBody.order_id === "A1" && typeof okBody.audit_ref === "string", "fetchHandler: POST action -> 200 + audit_ref", okBody);

  const bad = await handle(jsonReq("https://store.example/ai2w/actions/track-order", {}));
  check(bad.status === 400 && (await bad.json()).error.code === "invalid_request", "fetchHandler: action missing required -> 400");

  const miss = await handle(new Request("https://store.example/about"));
  check(miss.status === 404, "fetchHandler: non-AI2Web path -> 404 (adapter guards with isAi2wPath)");
}

// --- Hono middleware: serves AI2Web routes, passes everything else through ---
{
  const app = new Hono();
  app.use("*", honoAi2w(opts));
  app.get("/about", (c) => c.text("about page"));

  const m = await app.request("/ai2w");
  check(m.status === 200 && (await m.json()).protocol === "ai2w", "hono: GET /ai2w -> manifest");

  const about = await app.request("/about");
  check(about.status === 200 && (await about.text()) === "about page", "hono: /about passes through to the app route");

  const act = await app.request("/ai2w/actions/track-order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order_id: "B2" }) });
  check(act.status === 200 && (await act.json()).order_id === "B2", "hono: POST action dispatched");

  const nf = await app.request("/definitely-not-a-route");
  check(nf.status === 404, "hono: unknown non-AI2Web route falls through to Hono's 404");

  const wk = await app.request("http://localhost/.well-known/ai2w");
  check((await wk.json()).ai2w === "http://localhost/ai2w", "hono: serves the well-known pointer");
}

// --- Astro endpoint factory (createAi2wRoute) - an APIRoute over the same handler ---
{
  const ALL = createAi2wRoute(opts);
  const m = await ALL({ request: new Request("https://store.example/ai2w") });
  check(m.status === 200 && (await m.json()).protocol === "ai2w", "astro: createAi2wRoute serves /ai2w");

  const act = await ALL({ request: jsonReq("https://store.example/ai2w/actions/track-order", { order_id: "C3" }) });
  check(act.status === 200 && (await act.json()).order_id === "C3", "astro: createAi2wRoute dispatches an action");

  const llms = await ALL({ request: new Request("https://store.example/llms.txt") });
  check((llms.headers.get("content-type") ?? "").startsWith("text/plain"), "astro: createAi2wRoute serves /llms.txt");
}

console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
