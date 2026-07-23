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
 * Project the manifest to an OAuth 2.0 Protected Resource metadata document (RFC 9728),
 * served at `/.well-known/oauth-protected-resource`. MCP clients use this to discover which
 * authorization server guards a resource before starting a flow.
 *
 * Returns `null` when the site does not advertise oauth2, so a caller never publishes an
 * auth surface the site cannot honour.
 */
export function toOAuthProtectedResource(m: Manifest): Record<string, unknown> | null {
  if (!m.auth?.methods?.includes("oauth2")) return null;
  const base = trimUrl(m.site.url);
  const issuer = m.auth.oauth2?.authorization_url
    ? new URL(m.auth.oauth2.authorization_url).origin
    : base;
  const doc: Record<string, unknown> = {
    resource: `${base}/ai2w`,
    authorization_servers: [issuer],
    bearer_methods_supported: ["header"],
  };
  if (m.auth.oauth2?.scopes?.length) doc.scopes_supported = m.auth.oauth2.scopes;
  return doc;
}

/**
 * Map the manifest's `usage_policy` onto Content Signals tokens. `search` stays `yes` because
 * AI2Web exists to be discoverable; the AI signals are only asserted when the manifest states
 * them, so an unset policy is never reported as a refusal.
 *
 * Returns `null` when the manifest declares no usage policy at all.
 */
export function toContentSignals(m: Manifest): string | null {
  const p = m.usage_policy;
  if (!p || Object.keys(p).length === 0) return null;
  const signals = [`search=yes`];
  if (typeof p.content_reproduction === "boolean") {
    signals.push(`ai-input=${p.content_reproduction ? "yes" : "no"}`);
  }
  if (typeof p.model_training === "boolean") {
    signals.push(`ai-train=${p.model_training ? "yes" : "no"}`);
  }
  return signals.join(", ");
}

/**
 * Project the manifest to a robots.txt fragment: a Content-Signal line carrying the usage
 * policy, plus a pointer to the manifest. This is a FRAGMENT to append to an existing
 * robots.txt, never a replacement - the file belongs to the site owner.
 *
 * Returns an empty string when there is nothing to assert.
 */
export function toRobotsTxt(m: Manifest): string {
  const base = trimUrl(m.site.url);
  const signals = toContentSignals(m);
  const lines = [`# AI2Web usage policy, projected from ${base}/ai2w`];
  lines.push("User-agent: *");
  if (signals) lines.push(`Content-Signal: ${signals}`);
  if (m.usage_policy?.bulk_extraction === false) {
    lines.push("# bulk_extraction: false - please use the /ai2w endpoints instead of crawling");
  }
  lines.push(`# AI2Web-Manifest: ${base}/ai2w`);
  return lines.join("\n") + "\n";
}

/**
 * The value for an HTTP `Link` header advertising the manifest, so non-HTML clients can
 * discover it without parsing a page for `<link rel="ai2w">`.
 */
export function toDiscoveryLinkHeader(m: Manifest): string {
  return `<${trimUrl(m.site.url)}/ai2w>; rel="ai2w"`;
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
