// Pure mapping: AI2Web manifest -> NLWeb (nlweb.ai) query operations.
//
// NLWeb turns a site's content into a natural-language, schema.org-flavoured query endpoint (its
// `ask` API), and exposes itself as an MCP server. AI2Web does not define NLWeb; a site that runs
// (or projects) NLWeb advertises it under transports.nlweb, and this adapter lets an agent query
// that endpoint through the shared guarded executor in @ai2web/core (SSRF-checked, same-origin
// credentials - RFC-0006 §3), exactly like the ACP/AP2/MCP adapters.
//
// Note: NLWeb itself defines no discovery/well-known file, so the transports.nlweb advertisement
// is an AI2Web convention that points at the site's `/ask` (and optional `/mcp`) URLs.

import type { Manifest, Operation, Risk } from "@ai2web/core";

export type NlwebOperationName = "ask";

export type NlwebMode = "list" | "summarize" | "generate";

export interface NlwebOperation {
  name: NlwebOperationName;
  method: string;
  risk: Risk;
  requires_auth: boolean;
  requires_user_approval: boolean;
  description: string;
}

export interface NlwebAdapter {
  enabled: boolean;
  /** NLWeb response protocol version the site advertises (e.g. "0.55"). */
  version?: string;
  /** The `ask` endpoint (relative or absolute). */
  ask?: string;
  /** The NLWeb MCP endpoint, if advertised. */
  mcp?: string;
  /** Default `site` token to scope queries. */
  site?: string;
  /** Supported modes (list | summarize | generate). */
  modes?: string[];
  operations: NlwebOperation[];
}

export interface NlwebOptions {
  baseUrl?: string;
}

export interface NlwebAskArgs {
  /** The natural-language query. */
  query: string;
  /** Optional `site` token to scope the search (defaults to the advertised site). */
  site?: string;
  /** Response mode; defaults to the endpoint's default (list). */
  mode?: NlwebMode;
  /** Request a streaming (SSE) response. Defaults to false (buffered JSON) for programmatic use. */
  streaming?: boolean;
}

// NLWeb `ask` is a read-only content query: low risk, no approval.
const NLWEB_OPERATIONS: NlwebOperation[] = [
  { name: "ask", method: "GET", risk: "low", requires_auth: false, requires_user_approval: false, description: "Query the site's NLWeb endpoint in natural language and get schema.org-style results." },
];

interface NlwebTransport {
  enabled?: boolean;
  version?: string;
  ask?: string;
  mcp?: string;
  site?: string;
  modes?: string[];
}

function nlwebTransport(m: Manifest): NlwebTransport | undefined {
  const nl = (m.transports as Record<string, unknown> | undefined)?.nlweb as NlwebTransport | undefined;
  if (!nl?.enabled) return undefined;
  return nl;
}

/** Present the NLWeb query operation iff the site advertises the NLWeb transport. */
export function manifestToNlweb(m: Manifest): NlwebAdapter {
  const t = nlwebTransport(m);
  if (!t) return { enabled: false, operations: [] };
  return {
    enabled: true,
    version: t.version,
    ask: t.ask ?? "/ai2w/nlweb/ask",
    mcp: t.mcp,
    site: t.site,
    modes: t.modes,
    operations: NLWEB_OPERATIONS.map((o) => ({ ...o })),
  };
}

function joinUrl(baseUrl: string, endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `${baseUrl.replace(/\/+$/, "")}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
}

/** Build the concrete `ask` URL (with query string) from the advertised endpoint and args. */
export function buildAskUrl(m: Manifest, args: NlwebAskArgs, opts: NlwebOptions = {}): string {
  const t = nlwebTransport(m);
  if (!t) throw new Error("ai2w: site does not advertise the NLWeb transport");
  if (!args?.query) throw new Error("ai2w: NLWeb ask requires 'query'");
  const baseUrl = opts.baseUrl ?? m.site?.url ?? "";
  const endpoint = joinUrl(baseUrl, t.ask ?? "/ai2w/nlweb/ask");
  const params = new URLSearchParams();
  params.set("query", args.query);
  const site = args.site ?? t.site;
  if (site) params.set("site", String(site));
  if (args.mode) params.set("mode", args.mode);
  params.set("streaming", args.streaming ? "true" : "false");
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}${params.toString()}`;
}

/**
 * Resolve the NLWeb `ask` operation into a concrete, executable core `Operation`. Pure - no
 * network, no core value dependency.
 */
export function resolveNlwebOperation(op: NlwebOperation, m: Manifest, args: NlwebAskArgs, opts: NlwebOptions = {}): Operation {
  return {
    name: op.name,
    method: op.method,
    url: buildAskUrl(m, args, opts),
    requires_auth: op.requires_auth,
    requires_user_approval: op.requires_user_approval,
    risk: op.risk,
  };
}
