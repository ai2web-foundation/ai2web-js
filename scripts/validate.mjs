#!/usr/bin/env node
// AI2Web validator - runnable reference (zero-dependency, Node 18+).
// Usage:  node scripts/validate.mjs <url-or-file>
// This is the plain-JS mirror of @ai2web/validator so the tool is demonstrable
// before the TypeScript packages are built. Logic mirrors packages/core/src/score.ts.

import { readFileSync } from "node:fs";

const RESET = "\x1b[0m", GREEN = "\x1b[32m", YELLOW = "\x1b[33m", RED = "\x1b[31m", DIM = "\x1b[2m", BOLD = "\x1b[1m";

async function loadManifest(target) {
  // Local file?
  if (!/^https?:\/\//i.test(target)) {
    return { manifest: JSON.parse(readFileSync(target, "utf8")), source: target };
  }
  // Remote: try /ai2w then /.well-known/ai2w
  const base = target.replace(/\/+$/, "");
  const candidates = /\/ai2w(\/|$)|\/\.well-known\/ai2w$/.test(base)
    ? [base]
    : [`${base}/ai2w`, `${base}/.well-known/ai2w`];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" }, redirect: "follow" });
      if (!res.ok) continue;
      const json = await res.json();
      // pointer form: { "ai2w": "https://.../ai2w" }
      if (json && typeof json.ai2w === "string" && !json.protocol) {
        const r2 = await fetch(json.ai2w, { headers: { accept: "application/json" } });
        if (r2.ok) return { manifest: await r2.json(), source: json.ai2w };
      }
      return { manifest: json, source: url };
    } catch { /* try next */ }
  }
  throw new Error(`No AI2Web manifest found at ${base}/ai2w or ${base}/.well-known/ai2w`);
}

// ---- validation + scoring (mirrors the spec §9/§11) ----
function evaluate(m) {
  const errors = [], checks = [];
  const has = (v) => v === true || (v && typeof v === "object" && v.enabled === true);
  const cap = (name) => m.capabilities?.[name];

  // hard requirements (Basic tier)
  if (m.protocol !== "ai2w") errors.push("protocol must be 'ai2w'");
  if (!/^\d+\.\d+(\.\d+)?$/.test(String(m.version ?? ""))) errors.push("version missing/invalid");
  for (const k of ["name", "url", "type"]) if (!m.site?.[k]) errors.push(`site.${k} missing`);
  if (!m.capabilities || Object.keys(m.capabilities).length === 0) errors.push("capabilities empty");

  const actionsExist = has(cap("actions")) || (Array.isArray(m.actions) && m.actions.length > 0) ||
    ["commerce", "booking"].some((c) => has(cap(c)));

  // scoring buckets
  let score = 0;
  const add = (ok, pts, label, warnHint) => {
    checks.push({ ok: !!ok, pts, label, hint: ok ? null : warnHint });
    if (ok) score += pts;
  };

  add(errors.length === 0, 30, "Valid discovery manifest", "fix errors above");
  add(has(cap("content")), 6, "Content", "expose content module");
  add(has(cap("commerce")) || has(cap("booking")) || has(cap("services")), 6, "Products / services / booking", "expose a commerce/services/booking module");
  add(has(cap("search")), 4, "Search", "add a search capability");
  add(actionsExist, 5, "Actions", "declare actions");
  add(has(cap("events")), 6, "Events / subscriptions", "publish subscribable events");
  add(has(m.agent_service), 4, "Agent service (A2A)", "expose /ai2w/agent");
  // commerce depth
  const commerce = cap("commerce");
  add(!has(commerce) || commerce?.checkout === true, 4, "Checkout", "commerce present but checkout missing");
  // transports
  add(m.transports?.mcp?.enabled === true, 8, "MCP transport", "expose an MCP endpoint");
  add(m.transports?.rest?.enabled === true || m.transports?.feeds, 4, "REST / feeds", "expose REST or feeds");
  // auth + consent (weighted by whether actions exist)
  const oauthOk = Array.isArray(m.auth?.methods) && m.auth.methods.includes("oauth2") && m.auth?.oauth2?.pkce === true;
  add(!actionsExist || oauthOk, 8, "OAuth2 + PKCE", "protected actions need oauth2+pkce");
  add(!actionsExist || (m.consent?.requires_user_approval_for?.length > 0), 7, "Consent declared", "declare consent for sensitive actions");
  // trust
  add(!!m.identity, 4, "Identity", "add identity (legal_name, policies)");
  add(!!m.contact, 4, "Contact", "add support/security contact");

  score = Math.min(100, score);

  // compliance tier (spec §11)
  const basic = errors.length === 0;
  const standard = basic && m.transports && (!actionsExist || m.consent) && m.contact;
  const enterprise = standard && m.identity && m.auth && m.rate_limits;
  const tier = enterprise ? "Enterprise" : standard ? "Standard" : basic ? "Basic" : "Invalid";

  return { errors, checks, score, tier };
}

function render(source, { errors, checks, score, tier }) {
  console.log(`\n${BOLD}AI2Web Validator${RESET} ${DIM}${source}${RESET}\n`);
  if (errors.length) {
    console.log(`${RED}Errors:${RESET}`);
    for (const e of errors) console.log(`  ${RED}✗${RESET} ${e}`);
    console.log("");
  }
  for (const c of checks.filter((c) => c.label !== "Valid discovery manifest")) {
    if (c.ok) console.log(`  ${GREEN}✓${RESET} ${c.label}`);
    else console.log(`  ${YELLOW}⚠${RESET} ${c.label} ${DIM}- ${c.hint}${RESET}`);
  }
  const band = score >= 80 ? GREEN : score >= 50 ? YELLOW : RED;
  console.log(`\n  ${BOLD}AI Readiness Score${RESET}  ${band}${score}/100${RESET}   ${DIM}Tier:${RESET} ${tier}\n`);
  return tier === "Invalid" ? 1 : 0;
}

const target = process.argv[2];
if (!target) { console.error("Usage: node scripts/validate.mjs <url-or-file>"); process.exit(2); }
try {
  const { manifest, source } = await loadManifest(target);
  process.exit(render(source, evaluate(manifest)));
} catch (err) {
  console.error(`${RED}error:${RESET} ${err.message}`);
  process.exit(2);
}
