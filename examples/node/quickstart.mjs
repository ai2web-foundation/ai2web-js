// Plain JavaScript (no TypeScript, no build step). Run with: node quickstart.mjs
// The @ai2web/* packages ship as standard ESM + type declarations, so they work
// identically in JavaScript and TypeScript.

import { ai2web, validateManifest, renderBadgeSvg } from "@ai2web/core";

// 1. Describe your site once.
const manifest = ai2web({ name: "Acme Shoes", url: "https://acme.example", type: "ecommerce" })
  .capability("content")
  .capability("commerce", { checkout: true, returns: true })
  .action({
    name: "track_order",
    description: "Track an order",
    method: "GET",
    endpoint: "/ai2w/actions/track-order",
    requires_auth: true,
    requires_user_approval: false,
    risk: "medium",
    input_schema: { type: "object", properties: { order_id: { type: "string" } }, required: ["order_id"] },
  })
  .consent({ requires_user_approval_for: ["purchase", "payment"] })
  .build();

// 2. Score its AI readiness.
const result = validateManifest(manifest);
console.log(`AI Readiness: ${result.score}/100 (${result.tier})`);
for (const c of result.checks) console.log(`${c.ok ? "  ok " : "  -- "} ${c.label}`);

// 3. Get an embeddable badge (a self-contained SVG string).
import { writeFileSync } from "node:fs";
writeFileSync(new URL("./badge.svg", import.meta.url), renderBadgeSvg(result));
console.log("Wrote badge.svg");
