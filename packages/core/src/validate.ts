// Canonical validation + AI Readiness scoring. Mirrors spec §9/§11.
// (scripts/validate.mjs is the zero-dep runnable mirror of this logic.)

import type { Manifest, Capability, ValidationResult, Check, ComplianceTier } from "./types.js";

const has = (v: Capability | undefined): boolean =>
  v === true || (typeof v === "object" && v !== null && (v as { enabled?: boolean }).enabled === true);

/** Validate a parsed manifest and compute the AI Readiness Score + compliance tier. */
export function validateManifest(m: Manifest): ValidationResult {
  const errors: string[] = [];
  const checks: Check[] = [];
  const cap = (name: string) => m.capabilities?.[name];

  if (m.protocol !== "ai2w") errors.push("protocol must be 'ai2w'");
  if (!/^\d+\.\d+(\.\d+)?$/.test(String(m.version ?? ""))) errors.push("version missing/invalid");
  for (const k of ["name", "url", "type"] as const) if (!m.site?.[k]) errors.push(`site.${k} missing`);
  if (!m.capabilities || Object.keys(m.capabilities).length === 0) errors.push("capabilities empty");

  const actionsExist =
    has(cap("actions")) ||
    (Array.isArray(m.actions) && m.actions.length > 0) ||
    ["commerce", "booking"].some((c) => has(cap(c)));

  let score = 0;
  const add = (ok: boolean, points: number, label: string, hint: string) => {
    checks.push({ ok, points, label, hint: ok ? null : hint });
    if (ok) score += points;
  };

  add(errors.length === 0, 30, "Valid discovery manifest", "fix errors");
  add(has(cap("content")), 6, "Content", "expose content module");
  add(has(cap("commerce")) || has(cap("booking")) || has(cap("services")), 6, "Products / services / booking", "expose a commerce/services/booking module");
  add(has(cap("search")), 4, "Search", "add a search capability");
  add(actionsExist, 5, "Actions", "declare actions");
  add(has(cap("events")), 6, "Events / subscriptions", "publish subscribable events");
  add(!!m.agent_service?.enabled, 4, "Agent service (A2A)", "expose /ai2w/agent");

  const commerce = cap("commerce");
  add(!has(commerce) || (commerce as { checkout?: boolean })?.checkout === true, 4, "Checkout", "commerce present but checkout missing");

  add(m.transports?.mcp?.enabled === true, 8, "MCP transport", "expose an MCP endpoint");
  add(m.transports?.rest?.enabled === true || !!m.transports?.feeds, 4, "REST / feeds", "expose REST or feeds");

  const oauthOk = !!m.auth?.methods?.includes("oauth2") && m.auth?.oauth2?.pkce === true;
  const consentDeclared = (m.consent?.requires_user_approval_for?.length ?? 0) > 0;
  add(!actionsExist || oauthOk, 8, "OAuth2 + PKCE", "protected actions need oauth2+pkce");
  add(!actionsExist || consentDeclared, 7, "Consent declared", "declare consent for sensitive actions");

  add(!!m.identity, 4, "Identity", "add identity (legal_name, policies)");
  add(!!m.contact, 4, "Contact", "add support/security contact");

  score = Math.min(100, score);

  const basic = errors.length === 0;
  const standard = basic && !!m.transports && (!actionsExist || consentDeclared) && !!m.contact;
  const enterprise = standard && !!m.identity && !!m.auth && !!m.rate_limits;
  const tier: ComplianceTier = enterprise ? "Enterprise" : standard ? "Standard" : basic ? "Basic" : "Invalid";

  return { valid: errors.length === 0, errors, checks, score, tier };
}
