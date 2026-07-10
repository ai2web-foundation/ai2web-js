// OpenAPI adapter verification (RFC-0006 §3.1 / §4). OpenAPI is descriptive, so the checks
// prove the document describes EXACTLY the declared actions and preserves auth + risk /
// approval semantics. Zero-build: runs under `node --experimental-strip-types`.

import { readFileSync } from "node:fs";
import { manifestToOpenApi } from "../packages/openapi-adapter/src/openapi.ts";

const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`../test/fixtures/${name}.json`, import.meta.url), "utf8"));

let failures = 0;
const check = (cond: boolean, label: string, detail?: unknown) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) { failures++; if (detail !== undefined) console.log("      got:", JSON.stringify(detail)); }
};

function ops(doc: any): any[] {
  const out: any[] = [];
  for (const path of Object.values(doc.paths)) for (const op of Object.values(path as any)) out.push(op);
  return out;
}

const eco = load("ecommerce");
const doc: any = manifestToOpenApi(eco);

// O1 - a valid OpenAPI 3.1 document with the site as server.
check(doc.openapi === "3.1.0" && doc.servers?.[0]?.url === eco.site.url && doc["x-ai2w"]?.protocol === "ai2w", "O1 emits OpenAPI 3.1 with site server + x-ai2w marker", { openapi: doc.openapi, server: doc.servers?.[0]?.url });

// O2 - describes EXACTLY the declared actions (operationIds match, no phantom paths).
const declared = (eco.actions ?? []).map((a: any) => a.name).sort();
const described = ops(doc).map((o) => o.operationId).filter((id: string) => id !== "ask_site_agent").sort();
check(JSON.stringify(declared) === JSON.stringify(described), "O2 describes exactly the declared actions (no phantom operations)", { declared, described });

// O3 - every action's endpoint + method is present as a path item.
const allPresent = (eco.actions ?? []).every((a: any) => {
  const key = a.endpoint.startsWith("/") ? a.endpoint : `/${a.endpoint}`;
  return doc.paths[key]?.[a.method.toLowerCase()];
});
check(allPresent, "O3 each action maps to its endpoint + method");

// O4 - requires_auth actions carry an OpenAPI security requirement; public ones do not.
const bad = (eco.actions ?? []).find((a: any) => {
  const key = a.endpoint.startsWith("/") ? a.endpoint : `/${a.endpoint}`;
  const op = doc.paths[key][a.method.toLowerCase()];
  return a.requires_auth ? !op.security : Boolean(op.security);
});
check(!bad, "O4 requires_auth -> security requirement; public -> none", bad?.name);

// O5 - risk + approval semantics preserved as x-ai2w-* on each operation.
const refund = (eco.actions ?? []).find((a: any) => a.name === "request_refund");
if (refund) {
  const op = doc.paths[refund.endpoint][refund.method.toLowerCase()];
  check(op["x-ai2w-risk"] === "high" && op["x-ai2w-requires-user-approval"] === true, "O5 high-risk action preserves risk + approval extensions", op);
} else {
  check(false, "O5 fixture missing request_refund");
}

// O6 - a high-risk action declared approval:false still surfaces requires-approval:true (risk tier).
{
  const m: any = { protocol: "ai2w", version: "0.1", site: { name: "S", url: "https://s.example", type: "ecommerce" }, capabilities: { actions: { enabled: true } }, auth: { methods: ["oauth2"], oauth2: { token_url: "https://s.example/token", scopes: ["orders"] } },
    actions: [{ name: "delete_account", description: "x", method: "POST", endpoint: "/ai2w/actions/delete", requires_auth: true, requires_user_approval: false, risk: "high", input_schema: {} }] };
  const d: any = manifestToOpenApi(m);
  const op = d.paths["/ai2w/actions/delete"].post;
  check(op["x-ai2w-requires-user-approval"] === true && d.components.securitySchemes.oauth2?.type === "oauth2", "O6 high-risk approval:false still flagged; oauth2 scheme emitted", op);
}

// O7 - GET actions use query parameters, not a request body.
{
  const m: any = { protocol: "ai2w", version: "0.1", site: { name: "S", url: "https://s.example", type: "ecommerce" }, capabilities: { actions: { enabled: true } },
    actions: [{ name: "get_thing", description: "x", method: "GET", endpoint: "/ai2w/actions/get-thing", requires_auth: false, requires_user_approval: false, risk: "low", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } }] };
  const d: any = manifestToOpenApi(m);
  const op = d.paths["/ai2w/actions/get-thing"].get;
  check(op.parameters?.[0]?.name === "id" && op.parameters[0].in === "query" && op.parameters[0].required === true && !op.requestBody, "O7 GET action uses required query parameters (no body)", op);
}

console.log(`\n${failures === 0 ? "✅ ALL OPENAPI ADAPTER CHECKS PASS (RFC-0006 §3.1/§4)" : failures + " FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
