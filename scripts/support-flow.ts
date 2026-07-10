// AGENTIC SUPPORT FLOW - the "just ask your assistant" scenario, in-process.
//   User: "Where's my order?"                         → track_order executes → tracking
//   User: "They arrived damaged - I want a refund."   → report_issue executes; request_refund
//                                                        PREVIEWS (high-risk) → user approves → executes
// Uses the enriched ecommerce manifest + the REAL action→tool mapping. The invoke policy
// mirrors @ai2web/mcp-bridge invokeTool (RFC-0003 §4.4 / RFC-0007).

import { readFileSync } from "node:fs";
import { manifestToMcpTools, type McpToolDef } from "../packages/mcp-bridge/src/tools.ts";

const manifest = JSON.parse(readFileSync(new URL("../test/fixtures/ecommerce.json", import.meta.url), "utf8"));
const tools = manifestToMcpTools(manifest);
const tool = (id: string) => tools.find((t) => t.name === id)!;

let failures = 0;
const assert = (c: boolean, label: string, detail?: unknown) => {
  console.log(`${c ? "PASS" : "FAIL"}  ${label}`);
  if (!c) { failures++; if (detail !== undefined) console.log("      got:", JSON.stringify(detail)); }
};

// Simulated brand back-end (stands in for the site's support endpoints / brand agent).
async function backend(name: string, input: any): Promise<any> {
  switch (name) {
    case "track_order": return { order_id: input.order_id, status: "in_transit", carrier: "DPD", eta: "tomorrow 12:00", last: "Out for delivery" };
    case "report_issue": return { ticket: "T-5521", order_id: input.order_id, received_evidence: (input.evidence || []).length, status: "logged" };
    case "request_refund": return { refund_id: "R-9087", amount: "£20.00", method: "original payment", audit_ref: "aud_01H8", status: "refunded" };
    default: return { ok: true };
  }
}

// Mirror of invokeTool (RFC-0003 §4.4): preview when approval required OR risk high; else execute.
async function invoke(t: McpToolDef, input: any): Promise<any> {
  if (t.invoke.requires_user_approval || t.invoke.risk === "high") {
    return { preview: true, action: t.name, risk: t.invoke.risk, proposed: input };
  }
  return backend(t.name, input);
}

async function run() {
  console.log('\n── "Where is my Adidas order?" ──');
  const track = tool("track_order");
  assert(track.invoke.requires_auth === true, "track_order requires the user's authorization (their order)");
  const tracking = await invoke(track, { order_id: "A1023" });           // medium, approval:false → executes
  assert(tracking.status === "in_transit" && !tracking.preview, "track_order EXECUTES - no needless prompt for a read", tracking);
  console.log(`   → ${tracking.carrier}: ${tracking.last}, ETA ${tracking.eta}`);

  console.log('\n── "They arrived damaged - I want a refund." ──');
  const report = tool("report_issue");
  const logged = await invoke(report, { order_id: "A1023", description: "Left shoe sole is split", evidence: [{ type: "image", url: "https://user.example/damage1.jpg" }] });
  assert(logged.status === "logged" && logged.received_evidence === 1, "report_issue EXECUTES and accepts photo evidence", logged);
  console.log(`   → issue logged as ${logged.ticket} with ${logged.received_evidence} photo`);

  const refund = tool("request_refund");
  const preview = await invoke(refund, { order_id: "A1023", reason: "damaged" });   // high → preview
  assert(preview.preview === true, "request_refund PREVIEWS first (high-risk, money) - never auto-refunds", preview);
  console.log(`   → preview shown to user (approval required): refund for order ${preview.proposed.order_id}`);

  // ...user approves in their assistant → the client re-invokes with an approval grant.
  const done = await backend("request_refund", { order_id: "A1023" });             // executes after approval
  assert(done.status === "refunded" && !!done.audit_ref, "after approval, refund executes with an audit reference", done);
  console.log(`   → refunded ${done.amount} to ${done.method} · audit ${done.audit_ref}`);

  console.log(`\n${failures === 0 ? "✅ SUPPORT FLOW OK - track (read, instant) + refund (approval-gated), all from one ask" : failures + " FAILED"}`);
  process.exit(failures === 0 ? 0 : 1);
}
run();
