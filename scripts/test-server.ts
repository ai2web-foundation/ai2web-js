// Multi-surface serving (B3, RFC-0015): the handler emits the one canonical manifest as
// /llms.txt and /.well-known/agent.json alongside the native /ai2w routes.
// Run: node --experimental-strip-types scripts/test-server.ts
import { createAi2wHandler } from "../packages/server/src/handler.ts";
import { ai2web } from "../packages/core/src/builder.ts";

let fails = 0;
function check(cond: boolean, label: string): void {
  console.log((cond ? "PASS" : "FAIL") + "  " + label);
  if (!cond) fails++;
}

const manifest = ai2web({ name: "Example Bistro", url: "https://bistro.example", type: "restaurant", description: "Italian, terrace dining." })
  .capability("content")
  .capability("commerce", { endpoint: "/ai2w/products" })
  .action({ name: "book_table", description: "Reserve a table.", method: "POST", endpoint: "/ai2w/actions/book-table", requires_auth: false, requires_user_approval: true, risk: "medium", intent: "reserve_table" })
  .knowledge([{ id: "menu", name: "Menu", kind: "catalog", ref: "/ai2w/products", format: "json" }])
  .governance({ rate_limits: { requests: 60, window_seconds: 60 } })
  .build();

const handle = createAi2wHandler({ manifest });

// --- llms.txt ---
const llms = await handle({ method: "GET", path: "/llms.txt", origin: "https://bistro.example" });
check(llms.status === 200, "llms.txt: 200");
check(llms.raw === true, "llms.txt: raw text body (not JSON-quoted)");
check((llms.headers["content-type"] ?? "").startsWith("text/plain"), "llms.txt: text/plain");
check(typeof llms.body === "string" && llms.body.startsWith("# Example Bistro"), "llms.txt: title");
check(typeof llms.body === "string" && llms.body.includes("- commerce"), "llms.txt: capabilities");
check(typeof llms.body === "string" && llms.body.includes("book_table: Reserve a table."), "llms.txt: actions");

// --- agent.json (well-known + alias) ---
const aj = await handle({ method: "GET", path: "/.well-known/agent.json", origin: "https://bistro.example" });
check(aj.status === 200, "agent.json: 200");
check((aj.headers["content-type"] ?? "").includes("application/json"), "agent.json: application/json");
const b = aj.body as Record<string, any>;
check(b.name === "Example Bistro", "agent.json: name");
check(Array.isArray(b.capabilities) && b.capabilities.includes("commerce"), "agent.json: capabilities");
check(b.actions?.[0]?.intent === "reserve_table", "agent.json: action intent");
check(b.policies?.governance?.rate_limits?.requests === 60, "agent.json: governance carried");

const alias = await handle({ method: "GET", path: "/agent.json" });
check(alias.status === 200 && (alias.body as any).name === "Example Bistro", "agent.json: /agent.json alias");

// --- guards + no regression ---
const post = await handle({ method: "POST", path: "/llms.txt" });
check(post.status === 405, "llms.txt: POST -> 405");
const man = await handle({ method: "GET", path: "/ai2w" });
check(man.status === 200 && (man.body as any).protocol === "ai2w", "native /ai2w still works");

console.log("\n" + (fails === 0 ? "ALL PASS" : fails + " FAILED"));
process.exit(fails === 0 ? 0 : 1);
