// BOTH-SIDED SPIKE - the "holy shit it works" proof, in-process.
// Discovery Network (site side) ─┐
//                                ├─► connector (agent side) finds → describes → negotiates → acts
// AI2Web manifests (site side) ──┘
// Self-contained within ai2web-js (local fixtures + an inline mini-registry mirroring
// @ai2web/directory) so this repo stands alone. The production Discovery Network lives
// in ai2web-directory. Runs on Node's native TS - no build/link step, no live assistant.

import { readFileSync } from "node:fs";
import { negotiate } from "../packages/core/src/negotiate.ts";
import { manifestToMcpTools, type McpToolDef } from "../packages/mcp-bridge/src/tools.ts";

const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`../test/fixtures/${name}.json`, import.meta.url), "utf8"));

// Inline mini Discovery Network (public metadata only) - mirrors ai2web-directory's toRecord/search.
const enabled = (v: unknown) => v === true || (typeof v === "object" && v !== null && (v as { enabled?: boolean }).enabled === true);
const toRecord = (m: any, id: string) => ({
  id, name: m.site?.name ?? id, url: m.site?.url ?? "", type: m.site?.type ?? "other",
  capabilities: Object.entries(m.capabilities ?? {}).filter(([, v]) => enabled(v)).map(([k]) => k),
});
const REGISTRY = ["ecommerce", "saas", "booking", "publisher"].map((n) => toRecord(load(n), n));
const search = (q: { capability?: string; text?: string }) =>
  REGISTRY.filter((r) => (!q.capability || r.capabilities.includes(q.capability)) &&
    (!q.text || `${r.name} ${r.type}`.toLowerCase().includes(q.text.toLowerCase())));

let failures = 0;
const assert = (cond: boolean, label: string, detail?: unknown) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) { failures++; if (detail !== undefined) console.log("      got:", JSON.stringify(detail)); }
};

const AGENT = { transports: ["mcp", "rest"], capabilities: ["content", "commerce", "events", "actions"], auth: ["oauth2", "none"] };

console.log("\n── Step 1: agent searches the Discovery Network ──");
const hits = search({ capability: "commerce", text: "store" });
assert(hits.length >= 1 && hits[0].id === "ecommerce", "Discovery Network returns a commerce site", hits.map((h) => h.id));
assert(!("orders" in hits[0]) && !("customers" in (hits[0] as object)), "record holds only public metadata (privacy by design)");
const site = hits[0];
console.log(`   → found: ${site.name} (${site.capabilities.join(", ")})`);

console.log("\n── Step 2: agent describes the site + negotiates ──");
const manifest = load("ecommerce"); // stands in for discover(site.url)
const neg = negotiate(manifest, AGENT);
assert(neg.negotiated.transport === "mcp", "negotiated transport = mcp", neg.negotiated.transport);
assert(neg.negotiated.capabilities.includes("commerce"), "negotiated capabilities include commerce", neg.negotiated.capabilities);
console.log(`   → transport: ${neg.negotiated.transport}; caps: ${neg.negotiated.capabilities.join(", ")}`);

console.log("\n── Step 3: agent maps the site's actions to callable tools ──");
const tools = manifestToMcpTools(manifest);
assert(tools.some((t) => t.name === "check_stock"), "check_stock tool available", tools.map((t) => t.name));
console.log(`   → tools: ${tools.map((t) => t.name).join(", ")}`);

async function invoke(tool: McpToolDef, input: Record<string, unknown>): Promise<unknown> {
  if (tool.invoke.requires_user_approval) {
    return { preview: true, action: tool.name, risk: tool.invoke.risk, message: "requires user approval", proposed: input };
  }
  if (tool.name === "check_stock") return { sku: input.sku, available: true, price: "£20.00", delivery: "2-4 working days" };
  return { ok: true };
}

console.log("\n── Step 4: low-risk action executes; high-risk action is approval-gated ──");
const checkStock = tools.find((t) => t.name === "check_stock")!;
const stock = (await invoke(checkStock, { sku: "ADI-CF-12", size: "UK 12", colour: "black" })) as { available: boolean };
assert(stock.available === true, "check_stock executes and returns a result", stock);
console.log(`   → check_stock:`, JSON.stringify(stock));

const bookingTools = manifestToMcpTools(load("booking"));
const bookSlot = bookingTools.find((t) => t.name === "book_slot")!;
const preview = (await invoke(bookSlot, { slot_id: "S1" })) as { preview?: boolean };
assert(preview.preview === true, "book_slot (high-risk) returns approval preview, does NOT execute", preview);
console.log(`   → book_slot:`, JSON.stringify(preview));

console.log(`\n${failures === 0 ? "✅ END-TO-END SPIKE PASSED - discover → describe → negotiate → act (with approval gating)" : failures + " FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
