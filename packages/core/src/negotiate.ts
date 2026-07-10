// Capability negotiation (spec §5 / RFC-0001 §4).
// Site advertises its full set; agent uses the subset it understands. Result = intersection.

import type { Manifest, Capability } from "./types.js";

export interface AgentSupports {
  transports?: string[];
  capabilities?: string[];
  auth?: string[];
}

export interface Negotiated {
  transport: string | null;
  capabilities: string[];
  auth: string | null;
  endpoints: Record<string, string>;
}

export interface NegotiationResult {
  negotiated: Negotiated;
  unsupported: string[];
}

const enabled = (v: Capability | undefined): boolean =>
  v === true || (typeof v === "object" && v !== null && (v as { enabled?: boolean }).enabled === true);

const endpointOf = (name: string, v: Capability | undefined): string =>
  (typeof v === "object" && v !== null && typeof (v as { endpoint?: string }).endpoint === "string"
    ? (v as { endpoint: string }).endpoint
    : `/ai2w/${name}`);

export function negotiate(m: Manifest, agent: AgentSupports = {}): NegotiationResult {
  const siteCaps = Object.entries(m.capabilities ?? {})
    .filter(([, v]) => enabled(v))
    .map(([k]) => k);

  const wantCaps = agent.capabilities ?? siteCaps;
  const capabilities = siteCaps.filter((c) => wantCaps.includes(c));
  const unsupported = wantCaps.filter((c) => !siteCaps.includes(c));

  // Transport: honour the agent's preference order; fall back to site order.
  // Only transports explicitly enabled are negotiable (a disabled transport must
  // never be advertised as the chosen one).
  const siteTransports = Object.entries(m.transports ?? {})
    .filter(([, v]) => (v as { enabled?: boolean })?.enabled === true)
    .map(([k]) => k);
  const wantTransports = agent.transports ?? siteTransports;
  const transport = wantTransports.find((t) => siteTransports.includes(t)) ?? null;

  // Auth: prefer oauth2 if both support it. Negotiate in string space (the agent's
  // declared support is string[], and Negotiated.auth is string | null).
  const siteAuth: string[] = m.auth?.methods ?? ["none"];
  const wantAuth: string[] = agent.auth ?? siteAuth;
  const auth =
    (siteAuth.includes("oauth2") && wantAuth.includes("oauth2") && "oauth2") ||
    wantAuth.find((a) => siteAuth.includes(a)) ||
    (siteAuth.includes("none") ? "none" : null);

  const endpoints: Record<string, string> = {};
  for (const c of capabilities) endpoints[c] = endpointOf(c, m.capabilities[c]);
  if (transport && m.transports?.[transport] && typeof m.transports[transport] === "object") {
    const t = m.transports[transport] as { endpoint?: string; base?: string };
    if (t.endpoint) endpoints[transport] = t.endpoint;
  }

  return { negotiated: { transport, capabilities, auth, endpoints }, unsupported };
}
