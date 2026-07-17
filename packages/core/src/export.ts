// Export adapters (RFC-0015): project the one canonical AI2Web manifest into other wire
// formats and discovery surfaces. Each export is a best-effort projection; where a target
// cannot represent a field, it is omitted rather than misstated. The canonical /ai2w manifest
// stays authoritative for execution.

import type { Manifest } from "./types.js";

const enabled = (v: unknown): boolean =>
  v === true || (!!v && typeof v === "object" && (v as { enabled?: boolean }).enabled === true);

const trimUrl = (u: string): string => u.replace(/\/+$/, "");

function enabledCapabilities(m: Manifest): string[] {
  return Object.entries(m.capabilities).filter(([, v]) => enabled(v)).map(([k]) => k);
}

/**
 * Project the manifest to an `llms.txt` document: a plain-text summary and set of links a
 * model can read for content and guidance. Reads only; no actions are exposed here.
 */
export function toLlmsTxt(m: Manifest): string {
  const base = trimUrl(m.site.url);
  const lines: string[] = [`# ${m.site.name}`];
  if (m.site.description) lines.push("", `> ${m.site.description}`);

  const caps = enabledCapabilities(m);
  if (caps.length) lines.push("", "## Capabilities", ...caps.map((c) => `- ${c}`));

  if (m.knowledge?.length) {
    lines.push("", "## Knowledge");
    for (const k of m.knowledge) {
      const ref = k.ref.startsWith("http") ? k.ref : base + (k.ref.startsWith("/") ? "" : "/") + k.ref;
      lines.push(`- [${k.name ?? k.id}](${ref})`);
    }
  }

  if (m.actions?.length) {
    lines.push("", "## Actions");
    for (const a of m.actions) lines.push(`- ${a.name}: ${a.description}`);
  }

  lines.push("", "## Discovery", `- Manifest: ${base}/ai2w`);
  return lines.join("\n") + "\n";
}

/**
 * Project the manifest to a generic `agent.json` style capability document (a well-known
 * agent-description surface). This is a best-effort, format-neutral projection of identity,
 * capabilities, actions (with bindings), knowledge and policies. Consent/governance that a
 * target cannot express are carried as a `policies` object rather than dropped silently.
 */
export function toAgentJson(m: Manifest): Record<string, unknown> {
  return {
    schema: "agent-capabilities",
    name: m.site.name,
    description: m.site.description,
    url: m.site.url,
    identity: m.identity,
    capabilities: enabledCapabilities(m),
    actions: (m.actions ?? []).map((a) => ({
      name: a.name,
      intent: a.intent,
      description: a.description,
      risk: a.risk,
      requires_consent: a.requires_user_approval,
      requires_auth: a.requires_auth,
      input_schema: a.input_schema,
      bindings: a.bindings ?? [{ kind: "rest", ref: a.endpoint }],
    })),
    knowledge: m.knowledge,
    transports: m.transports,
    policies: {
      consent: m.consent?.requires_user_approval_for,
      governance: m.governance,
      usage: m.usage_policy,
      legal: m.legal,
    },
  };
}
