// Framework-agnostic AI2Web request handler. Serves the manifest, the well-known
// anchor, capability negotiation, and dispatches /ai2w/{module} + /ai2w/actions/{name}.

import { negotiate, validateSchema, toLlmsTxt, toAgentJson, type Manifest, type AgentSupports, type Deprecated } from "@ai2web/core";

/** Fresh audit reference for a state-changing action (RFC-0003/§0009). Opaque, no PII. */
function newAuditRef(): string {
  const rnd = globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
  return "aud_" + rnd.slice(0, 24);
}

/** RFC 8594 Deprecation/Sunset headers from an RFC-0011 marker. */
function deprecationHeaders(d?: Deprecated): Record<string, string> {
  if (!d) return {};
  const h: Record<string, string> = { Deprecation: d.since ?? "true" };
  if (d.sunset) { const t = new Date(d.sunset); h.Sunset = isNaN(t.getTime()) ? d.sunset : t.toUTCString(); }
  if (d.replacement) h.Link = `<${d.replacement}>; rel="successor-version"`;
  return h;
}

export interface Ai2wRequest {
  method: string;
  path: string;
  body?: unknown;
  origin?: string; // e.g. https://example.com - used to build the well-known pointer
  /** Coarse agent identity (RFC-0013), if the adapter can supply one from a header. */
  agent?: string;
  /** Audit reference for a state-changing action; set by the handler and passed to the action fn. */
  audit_ref?: string;
}

/**
 * A server-side interaction event (RFC-0016). Personal-data-free by default: no names, no full
 * order/message contents, no end-user identifiers beyond the opaque `audit_ref`. A `query` whose
 * `result` is `miss` is first-class - aggregated misses quantify demand a site could not meet.
 */
export interface Ai2wEvent {
  ts: string; // ISO timestamp
  type: "discovery" | "query" | "action" | "outcome";
  capability?: string; // for discovery/query (the module)
  name?: string; // action name
  intent?: string; // RFC-0014
  filters?: Record<string, string | number | boolean>; // sanitised, non-identifying query params
  result: "hit" | "miss" | "count" | "success" | "error";
  audit_ref?: string; // links a state-changing action to a transaction (RFC-0003)
  agent?: string;
  latency?: number; // ms
  error?: string;
}

export interface Ai2wResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  /** When true, `body` is a string to send verbatim (e.g. llms.txt), not JSON-serialized. */
  raw?: boolean;
}

export type ModuleHandler = (req: Ai2wRequest) => unknown | Promise<unknown>;

export interface Ai2wServerOptions {
  manifest: Manifest;
  /** Handlers for /ai2w/{module} (e.g. content, products, search, events). */
  modules?: Record<string, ModuleHandler>;
  /** Handlers for /ai2w/actions/{name}. */
  actions?: Record<string, ModuleHandler>;
  /**
   * Validate each action's request body against the `input_schema` it declares in the
   * manifest, returning a 400 `invalid_request` before the handler runs. Defaults to true,
   * so schema compliance is enforced per request without wiring your own checks. Set false
   * to opt out.
   */
  validateInput?: boolean;
  /**
   * Auto-discovery (opt-in): announce this site to the AI2Web Discovery Network the first time
   * it serves its manifest, so agents can find it via the connector without a manual submission.
   * Best-effort and non-blocking; only the site URL is sent - the directory re-fetches and
   * verifies the live manifest server-side. `true` uses the public directory; pass an object to
   * override the URL/endpoint (e.g. a private directory).
   */
  announce?: boolean | { url?: string; endpoint?: string; fetchImpl?: typeof fetch };
  /**
   * Analytics sink (RFC-0016). Called with one personal-data-free event per meaningful interaction
   * (discovery / query / action). Fired non-blocking, so a slow or failing sink never delays the
   * response. Local-first by default: store events in your own system, or use `analyticsEngineSink`.
   */
  onEvent?: (event: Ai2wEvent) => void | Promise<void>;
}

const DIRECTORY_REGISTER = "https://directory.ai2web.dev/register";
const _announced = new Set<string>();

/**
 * Announce a site to the AI2Web Discovery Network. Sends only the origin; the directory
 * re-fetches and verifies the live `/.well-known/ai2w` before listing. Returns whether the
 * directory accepted it. Safe to call on deploy/startup, ideally inside `ctx.waitUntil`.
 */
export async function announceToDirectory(
  siteUrl: string,
  opts: { endpoint?: string; fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const u = new URL(siteUrl);
    if (u.protocol !== "https:") return false; // the directory only accepts public https origins
    const res = await doFetch(opts.endpoint ?? DIRECTORY_REGISTER, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: u.origin }),
    });
    return (res as Response).ok;
  } catch {
    return false;
  }
}

// Keep only non-identifying scalar params (RFC-0016 §3.3): drop long keys/values, emails and
// long digit runs (phone/card/order ids), objects, and cap the count.
function sanitizeFilters(body: unknown): Record<string, string | number | boolean> | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (k.length > 24 || Object.keys(out).length >= 8) break;
    if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (typeof v === "string" && v.length <= 40 && !/@|\d{6,}/.test(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

// A query "miss" (empty result) is the demand signal a read-only crawl can't produce.
function isEmptyResult(x: unknown): boolean {
  if (Array.isArray(x)) return x.length === 0;
  if (x && typeof x === "object") {
    const o = x as { results?: unknown; count?: unknown; items?: unknown };
    if (Array.isArray(o.results)) return o.results.length === 0;
    if (Array.isArray(o.items)) return o.items.length === 0;
    if (typeof o.count === "number") return o.count === 0;
  }
  return false;
}

/**
 * onEvent sink that writes each event to a Cloudflare Analytics Engine dataset (no PII, SQL-queryable).
 * Bind an `analytics_engine_datasets` binding in wrangler and pass it here.
 */
export function analyticsEngineSink(dataset: { writeDataPoint: (o: { blobs?: (string | null)[]; doubles?: number[]; indexes?: string[] }) => void }) {
  return (e: Ai2wEvent): void => {
    try {
      dataset.writeDataPoint({
        blobs: [e.type, e.capability ?? e.name ?? "", e.result, e.agent ?? "", e.intent ?? "", e.error ?? "", e.audit_ref ?? ""],
        doubles: [e.latency ?? 0],
        indexes: [e.capability ?? e.name ?? e.type],
      });
    } catch { /* never let telemetry break a request */ }
  };
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

const json = (status: number, body: unknown): Ai2wResponse => ({
  status,
  headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  body,
});

const error = (status: number, code: string, message: string, retryable = false): Ai2wResponse =>
  json(status, { error: { code, message, retryable } });

const text = (status: number, contentType: string, body: string): Ai2wResponse => ({
  status,
  headers: { "content-type": contentType, ...CORS },
  raw: true,
  body,
});

const AI2W_EXACT = new Set(["/ai2w", "/ai", "/.ai", "/llms.txt", "/agent.json", "/.well-known/ai2w", "/.well-known/agent.json"]);

/**
 * True for a path AI2Web serves. Lets a framework adapter (Hono, Astro, Nuxt) intercept only
 * AI2Web routes and pass every other request through to the app.
 */
export function isAi2wPath(path: string): boolean {
  const p = path.replace(/\/+$/, "") || "/";
  return AI2W_EXACT.has(p) || p.startsWith("/ai2w/");
}

function safeJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return raw; }
}

/**
 * Web-standard adapter: a `(Request) => Promise<Response>` over the AI2Web handler, for any
 * Fetch-API runtime (Cloudflare Workers, Hono, Astro endpoints, Nuxt/Nitro, Bun, Deno). Parses a
 * JSON body for POST/PUT/PATCH, derives the origin from the URL, and forwards an `x-ai2w-agent`
 * header as the coarse agent id (RFC-0013). The shared core behind every framework adapter.
 */
export function fetchHandler(opts: Ai2wServerOptions): (request: Request) => Promise<Response> {
  const handle = createAi2wHandler(opts);
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    let body: unknown;
    const method = request.method.toUpperCase();
    if (method === "POST" || method === "PUT" || method === "PATCH") {
      const raw = await request.text();
      body = raw ? safeJson(raw) : undefined;
    }
    const agent = request.headers.get("x-ai2w-agent") ?? undefined;
    const res = await handle({ method: request.method, path: url.pathname, body, origin: url.origin, agent });
    const out = res.body === null ? "" : res.raw ? String(res.body) : JSON.stringify(res.body);
    return new Response(out, { status: res.status, headers: res.headers });
  };
}

export function createAi2wHandler(opts: Ai2wServerOptions) {
  const { manifest, modules = {}, actions = {}, validateInput = true } = opts;
  const declaredActions = new Map((manifest.actions ?? []).map((a) => [a.name, a]));

  // Auto-discovery: on the first discovery serve, announce this origin once per process.
  function maybeAnnounce(req: Ai2wRequest): void {
    if (!opts.announce) return;
    const a = opts.announce === true ? {} : opts.announce;
    const url = a.url ?? req.origin ?? (manifest.site as { url?: string } | undefined)?.url;
    if (!url || _announced.has(url)) return;
    _announced.add(url);
    void announceToDirectory(url, { endpoint: a.endpoint, fetchImpl: a.fetchImpl }); // best-effort, non-blocking
  }

  // Fire one analytics event (RFC-0016), non-blocking, never throwing into the request path.
  function emit(req: Ai2wRequest, start: number, e: Omit<Ai2wEvent, "ts" | "agent" | "latency">): void {
    if (!opts.onEvent) return;
    const event: Ai2wEvent = { ts: new Date().toISOString(), agent: req.agent, latency: Date.now() - start, ...e };
    try { void Promise.resolve(opts.onEvent(event)).catch(() => {}); } catch { /* sink errors never surface */ }
  }

  return async function handle(req: Ai2wRequest): Promise<Ai2wResponse> {
    const path = req.path.replace(/\/+$/, "") || "/";
    const method = req.method.toUpperCase();
    const start = Date.now();

    if (method === "OPTIONS") return { status: 204, headers: CORS, body: null };

    // Discovery anchor → pointer to /ai2w (spec §2).
    if (path === "/.well-known/ai2w") {
      maybeAnnounce(req);
      emit(req, start, { type: "discovery", result: "hit" });
      const home = `${(req.origin ?? "").replace(/\/+$/, "")}/ai2w`;
      return json(200, req.origin ? { ai2w: home } : manifest);
    }

    // Canonical manifest home + friendly alias.
    if (path === "/ai2w" || path === "/ai" || path === "/.ai") {
      if (method !== "GET") return error(405, "invalid_request", "Use GET for the manifest.");
      maybeAnnounce(req);
      emit(req, start, { type: "discovery", result: "hit" });
      const res = json(200, manifest);
      Object.assign(res.headers, deprecationHeaders(manifest.deprecated)); // RFC-0011
      return res;
    }

    // Multi-surface projections (RFC-0015): the one canonical manifest, emitted in other
    // discovery formats so agents that speak llms.txt or agent.json need not parse ai2w first.
    if (path === "/llms.txt") {
      if (method !== "GET") return error(405, "invalid_request", "Use GET for llms.txt.");
      return text(200, "text/plain; charset=utf-8", toLlmsTxt(manifest));
    }
    if (path === "/.well-known/agent.json" || path === "/agent.json") {
      if (method !== "GET") return error(405, "invalid_request", "Use GET for agent.json.");
      return json(200, toAgentJson(manifest));
    }

    // Capability negotiation (spec §5).
    if (path === "/ai2w/negotiate") {
      const b = (req.body ?? {}) as { agent?: { supports?: AgentSupports }; supports?: AgentSupports } & AgentSupports;
      const supports = b.agent?.supports ?? b.supports ?? b;
      return json(200, negotiate(manifest, supports as AgentSupports));
    }

    // Action dispatch: /ai2w/actions/{name}
    const actionMatch = path.match(/^\/ai2w\/actions\/([a-z0-9_-]+)$/i);
    if (actionMatch) {
      const name = actionMatch[1].replace(/-/g, "_");
      const fn = actions[name];
      if (!fn) return error(404, "unsupported_capability", `Unknown action '${name}'.`);
      // Enforce the action's declared input_schema on the incoming body (spec §12).
      const declared = declaredActions.get(name);
      if (validateInput && declared?.input_schema) {
        const result = validateSchema(req.body ?? {}, declared.input_schema);
        if (!result.valid) {
          return error(400, "invalid_request", `Request does not match the declared input schema: ${result.errors.join("; ")}.`);
        }
      }
      // Mint an audit_ref for state-changing actions (RFC-0003) and hand it to the action fn.
      const audit_ref = method === "GET" ? undefined : newAuditRef();
      try {
        const out = await fn({ ...req, audit_ref });
        const ref = (out as { audit_ref?: string } | null)?.audit_ref ?? audit_ref;
        // Ensure a state-changing action's response carries its audit_ref, even if the fn omitted it.
        const body = ref && out && typeof out === "object" && !Array.isArray(out) && !(out as { audit_ref?: string }).audit_ref
          ? { ...(out as object), audit_ref: ref } : out;
        emit(req, start, { type: "action", name, result: "success", audit_ref: ref });
        const res = json(200, body);
        Object.assign(res.headers, deprecationHeaders(declared?.deprecated)); // RFC-0011
        return res;
      } catch (err) {
        emit(req, start, { type: "action", name, result: "error", error: (err as Error)?.message?.slice(0, 120) });
        throw err;
      }
    }

    // Module dispatch: /ai2w/{module}
    const moduleMatch = path.match(/^\/ai2w\/([a-z0-9_-]+)$/i);
    if (moduleMatch) {
      const name = moduleMatch[1];
      const fn = modules[name];
      if (!fn) return error(404, "unsupported_capability", `Module '${name}' not exposed.`);
      const out = await fn(req);
      // A query "miss" (empty result) is a first-class demand signal (RFC-0016 §3.4).
      emit(req, start, { type: "query", capability: name, result: isEmptyResult(out) ? "miss" : "count", filters: sanitizeFilters(req.body) });
      return json(200, out);
    }

    return error(404, "invalid_request", `No AI2Web route for ${path}.`);
  };
}
