// v0.2 core: builder modules + export adapters. Run with:
//   node --experimental-strip-types scripts/test-interop.ts
import { ai2web } from "../packages/core/src/builder.ts";
import { toLlmsTxt, toAgentJson } from "../packages/core/src/export.ts";

let fails = 0;
function check(cond: boolean, label: string): void {
  console.log((cond ? "PASS" : "FAIL") + "  " + label);
  if (!cond) fails++;
}

const m = ai2web({ name: "Example Bistro", url: "https://bistro.example", type: "restaurant", description: "Italian, terrace dining." })
  .capability("content")
  .capability("commerce", { endpoint: "/ai2w/products" })
  .capability("search", { endpoint: "/ai2w/search" })
  .action({
    name: "book_table", description: "Reserve a table.", method: "POST",
    endpoint: "/ai2w/actions/book-table", requires_auth: false, requires_user_approval: true,
    risk: "medium", intent: "reserve_table",
    input_schema: { type: "object", properties: { date: { type: "string" }, party: { type: "integer" } }, required: ["date", "party"] },
    bindings: [
      { kind: "mcp", ref: "book_table", priority: 1 },
      { kind: "redirect", ref: "/reserve", priority: 9, fallback_only: true },
    ],
  })
  .knowledge([{ id: "menu", name: "Menu", kind: "catalog", ref: "/ai2w/products", format: "json" }])
  .governance({ rate_limits: { requests: 60, window_seconds: 60 }, consent_mode: { book_table: "explicit" } })
  .usagePolicy({ bulk_extraction: false, model_training: false })
  .legal({ jurisdiction: "EU", ai_transparency: true, ai_risk_classification: "limited" })
  .agentIdentity({ required: false, allow_anonymous: true, methods: ["http_message_signatures"] })
  .contact({ support: "hi@bistro.example" })
  .build();

// --- builder wired the v0.2 modules ---
check(m.governance?.rate_limits?.requests === 60, "builder: governance");
check(m.usage_policy?.model_training === false, "builder: usage_policy");
check(m.legal?.ai_risk_classification === "limited", "builder: legal");
check(m.identity?.agent?.methods?.[0] === "http_message_signatures", "builder: agent identity");
check(m.knowledge?.[0]?.id === "menu", "builder: knowledge");
check(m.actions?.[0]?.intent === "reserve_table", "action: intent");
check(m.actions?.[0]?.bindings?.length === 2, "action: bindings");
check(m.actions?.[0]?.bindings?.[1]?.fallback_only === true, "action: fallback_only binding");

// --- llms.txt export ---
const txt = toLlmsTxt(m);
check(txt.startsWith("# Example Bistro"), "llms.txt: title");
check(txt.includes("## Capabilities") && txt.includes("- commerce"), "llms.txt: capabilities");
check(txt.includes("## Knowledge") && txt.includes("Menu"), "llms.txt: knowledge");
check(txt.includes("book_table: Reserve a table."), "llms.txt: action");
check(txt.includes("https://bistro.example/ai2w"), "llms.txt: discovery link");

// --- agent.json export ---
const aj = toAgentJson(m);
check(aj.name === "Example Bistro", "agent.json: name");
check((aj.capabilities as string[]).includes("commerce"), "agent.json: capabilities");
const acts = aj.actions as Array<Record<string, unknown>>;
check(acts[0].intent === "reserve_table", "agent.json: action intent");
check((acts[0].bindings as unknown[]).length === 2, "agent.json: bindings preserved");
check((aj.policies as Record<string, any>).legal.jurisdiction === "EU", "agent.json: legal in policies");
check(typeof aj.policies === "object" && aj.policies !== null, "agent.json: policies object present");
check((aj.policies as Record<string, any>).governance?.consent_mode?.book_table === "explicit", "agent.json: governance carried in policies");

console.log("\n" + (fails === 0 ? "ALL PASS" : fails + " FAILED"));
process.exit(fails === 0 ? 0 : 1);
