// Framework-agnostic AI2Web request handler. Serves the manifest, the well-known
// anchor, capability negotiation, and dispatches /ai2w/{module} + /ai2w/actions/{name}.

import { negotiate, validateSchema, type Manifest, type AgentSupports } from "@ai2web/core";

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

export function createAi2wHandler(opts: Ai2wServerOptions) {
  const { manifest, modules = {}, actions = {}, validateInput = true } = opts;
  const declaredActions = new Map((manifest.actions ?? []).map((a) => [a.name, a]));

  return async function handle(req: Ai2wRequest): Promise<Ai2wResponse> {
    const path = req.path.replace(/\/+$/, "") || "/";
    const method = req.method.toUpperCase();

    if (method === "OPTIONS") return { status: 204, headers: CORS, body: null };

    // Discovery anchor → pointer to /ai2w (spec §2).
    if (path === "/.well-known/ai2w") {
      const home = `${(req.origin ?? "").replace(/\/+$/, "")}/ai2w`;
      return json(200, req.origin ? { ai2w: home } : manifest);
    }

    // Canonical manifest home + friendly alias.
    if (path === "/ai2w" || path === "/ai" || path === "/.ai") {
      if (method !== "GET") return error(405, "invalid_request", "Use GET for the manifest.");
      return json(200, manifest);
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
