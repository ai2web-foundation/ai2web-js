// Smoke test for the core protocol logic, run directly via Node's TS stripping.
// (Cross-module imports here are type-only in the source, so they strip cleanly.)
import { readFileSync } from "node:fs";
import { negotiate } from "../packages/core/src/negotiate.ts";
import { validateManifest } from "../packages/core/src/validate.ts";
import { ai2web } from "../packages/core/src/builder.ts";
import { manifestToMcpTools } from "../packages/mcp-bridge/src/tools.ts";

const m = JSON.parse(readFileSync(new URL("../test/fixtures/ecommerce.json", import.meta.url), "utf8"));

let failures = 0;
const assert = (cond: boolean, label: string, detail?: unknown) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) { failures++; if (detail !== undefined) console.log("      got:", JSON.stringify(detail)); }
};

// 1. Negotiation
const neg = negotiate(m, { transports: ["mcp", "rest"], capabilities: ["content", "commerce", "events", "flying"], auth: ["oauth2"] });
assert(neg.negotiated.transport === "mcp", "negotiate picks agent-preferred transport (mcp)", neg.negotiated.transport);
assert(JSON.stringify(neg.negotiated.capabilities) === JSON.stringify(["content", "commerce", "events"]), "negotiate intersects capabilities", neg.negotiated.capabilities);
assert(neg.negotiated.auth === "oauth2", "negotiate selects oauth2", neg.negotiated.auth);
assert(JSON.stringify(neg.unsupported) === JSON.stringify(["flying"]), "negotiate reports unsupported agent caps", neg.unsupported);
assert(neg.negotiated.endpoints.commerce === "/ai2w/products", "negotiate resolves module endpoint", neg.negotiated.endpoints);

// 2. MCP tool mapping (type-only import of @ai2web/core → stripped at runtime)
const tools = manifestToMcpTools(m);
const names = tools.map((t) => t.name).sort();
assert(names.includes("check_stock") && names.includes("track_order"), "mcp-bridge maps actions → tools", names);
assert(names.includes("ask_site_agent"), "mcp-bridge adds agent-service tool", names);
const trackOrder = tools.find((t) => t.name === "track_order")!;
assert(trackOrder.invoke.url === "https://store.example.com/ai2w/actions/track-order", "mcp-bridge resolves absolute invoke URL", trackOrder.invoke.url);
assert(trackOrder.invoke.requires_auth === true, "mcp-bridge preserves auth flag", trackOrder.invoke);

// 3. Core validation parity with the runnable mjs
const v = validateManifest(m);
assert(v.score === 100 && v.tier === "Standard", "validateManifest scores ecommerce 100/Standard", { score: v.score, tier: v.tier });

// 4. Builder round-trips through validation
const built = ai2web({ name: "T", url: "https://t.example", type: "ecommerce" })
  .capability("content")
  .capability("commerce", { endpoint: "/ai2w/products", checkout: true })
  .transports({ mcp: { enabled: true, endpoint: "/ai2w/mcp" }, rest: { enabled: true } })
  .auth({ methods: ["none", "oauth2"], oauth2: { pkce: true, scopes: ["checkout"] } })
  .consent({ requires_user_approval_for: ["purchase"] })
  .contact({ support: "x@t.example" })
  .build();
assert(built.protocol === "ai2w" && validateManifest(built).valid, "builder produces a valid manifest", validateManifest(built).errors);

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
