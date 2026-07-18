// Framework-agnostic AI2Web request handler. Serves the manifest, the well-known
// anchor, capability negotiation, and dispatches /ai2w/{module} + /ai2w/actions/{name}.

import { negotiate, validateSchema, toLlmsTxt, toAgentJson, type Manifest, type AgentSupports } from "@ai2web/core";

export interface Ai2wRequest {
  method: string;
  path: string;
  body?: unknown;
  origin?: string; // e.g. https://example.com - used to build the well-known pointer
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

  return async function handle(req: Ai2wRequest): Promise<Ai2wResponse> {
    const path = req.path.replace(/\/+$/, "") || "/";
    const method = req.method.toUpperCase();

    if (method === "OPTIONS") return { status: 204, headers: CORS, body: null };

    // Discovery anchor → pointer to /ai2w (spec §2).
    if (path === "/.well-known/ai2w") {
      maybeAnnounce(req);
      const home = `${(req.origin ?? "").replace(/\/+$/, "")}/ai2w`;
      return json(200, req.origin ? { ai2w: home } : manifest);
    }

    // Canonical manifest home + friendly alias.
    if (path === "/ai2w" || path === "/ai" || path === "/.ai") {
      if (method !== "GET") return error(405, "invalid_request", "Use GET for the manifest.");
      maybeAnnounce(req);
      return json(200, manifest);
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
      return json(200, await fn(req));
    }

    // Module dispatch: /ai2w/{module}
    const moduleMatch = path.match(/^\/ai2w\/([a-z0-9_-]+)$/i);
    if (moduleMatch) {
      const name = moduleMatch[1];
      const fn = modules[name];
      if (!fn) return error(404, "unsupported_capability", `Module '${name}' not exposed.`);
      return json(200, await fn(req));
    }

    return error(404, "invalid_request", `No AI2Web route for ${path}.`);
  };
}
