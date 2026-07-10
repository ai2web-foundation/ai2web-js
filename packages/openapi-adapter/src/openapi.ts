// Pure mapping: AI2Web manifest -> OpenAPI 3.1 document. Unlike the MCP/GraphQL/ACP
// adapters, OpenAPI is a *description* format (RFC-0006 §4: "describes the declared
// actions as an API document"), so there is no executor - but the document MUST still
// honour §3.1: it describes exactly the declared actions, and preserves requires_auth
// (as security) and risk / approval (as x-ai2w-* extensions) so a caller sees the real
// semantics. Type-only imports from @ai2web/core keep this runnable under the harness.

import type { Manifest, Action, Auth, Risk } from "@ai2web/core";

export interface OpenApiOptions {
  baseUrl?: string;
}

type Json = Record<string, unknown>;

function securitySchemes(auth?: Auth): { schemes: Json; ref?: string } {
  const methods = auth?.methods ?? [];
  if (methods.includes("oauth2")) {
    const o = auth?.oauth2 ?? {};
    const scopes: Json = {};
    for (const s of o.scopes ?? []) scopes[s] = s;
    return {
      ref: "oauth2",
      schemes: {
        oauth2: {
          type: "oauth2",
          flows: {
            authorizationCode: {
              authorizationUrl: o.authorization_url ?? "",
              tokenUrl: o.token_url ?? "",
              scopes,
            },
          },
        },
      },
    };
  }
  if (methods.includes("api_key")) {
    return { ref: "apiKey", schemes: { apiKey: { type: "apiKey", in: "header", name: "Authorization" } } };
  }
  // session / signed_request / bearer-style
  return { ref: "bearerAuth", schemes: { bearerAuth: { type: "http", scheme: "bearer" } } };
}

/** Turn a JSON-Schema-ish input_schema into OpenAPI query parameters (for GET actions). */
function toParameters(input: Json): Json[] {
  const props = (input?.properties as Json | undefined) ?? {};
  const required = new Set((input?.required as string[] | undefined) ?? []);
  return Object.entries(props).map(([name, schema]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema: schema as Json,
  }));
}

function operationFor(a: Action, secRef: string): Json {
  const op: Json = {
    operationId: a.name,
    summary: a.description,
    "x-ai2w-risk": a.risk as Risk,
    "x-ai2w-requires-user-approval": a.requires_user_approval || a.risk === "high",
    responses: { "200": { description: "OK" } },
  };
  if (a.requires_auth) op.security = [{ [secRef]: [] }];

  if (a.method === "GET") {
    const params = toParameters(a.input_schema ?? {});
    if (params.length) op.parameters = params;
  } else {
    op.requestBody = {
      required: true,
      content: { "application/json": { schema: a.input_schema ?? { type: "object" } } },
    };
  }
  return op;
}

/** Build an OpenAPI 3.1 document describing the manifest's declared actions. */
export function manifestToOpenApi(m: Manifest, opts: OpenApiOptions = {}): Json {
  const baseUrl = opts.baseUrl ?? m.site?.url ?? "";
  const { schemes, ref } = securitySchemes(m.auth);
  const secRef = ref ?? "bearerAuth";

  const paths: Json = {};
  const addPath = (endpoint: string, method: string, op: Json) => {
    const key = /^https?:\/\//i.test(endpoint) ? endpoint : endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const bucket = (paths[key] as Json) ?? (paths[key] = {});
    bucket[method.toLowerCase()] = op;
  };

  for (const a of m.actions ?? []) addPath(a.endpoint, a.method, operationFor(a, secRef));

  if (m.agent_service?.enabled && m.agent_service.endpoint) {
    addPath(m.agent_service.endpoint, "POST", {
      operationId: "ask_site_agent",
      summary: `Ask this site's AI agent. Intents: ${(m.agent_service.supported_intents ?? []).join(", ")}.`,
      "x-ai2w-risk": "low",
      "x-ai2w-requires-user-approval": false,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { type: "object", properties: { intent: { type: "string" }, message: { type: "string" } }, required: ["message"] },
          },
        },
      },
      responses: { "200": { description: "OK" } },
    });
  }

  return {
    openapi: "3.1.0",
    info: {
      title: `${m.site?.name ?? "Site"} - AI2Web actions`,
      version: m.version,
      description: `Generated from the AI2Web (ai2w) manifest. Risk and approval semantics are carried in x-ai2w-* fields; no capability beyond those declared is described.`,
    },
    servers: [{ url: baseUrl }],
    "x-ai2w": { protocol: "ai2w", version: m.version },
    components: { securitySchemes: schemes },
    paths,
  };
}

/** Convenience: the OpenAPI document as a JSON string. */
export function manifestToOpenApiJson(m: Manifest, opts: OpenApiOptions = {}): string {
  return JSON.stringify(manifestToOpenApi(m, opts), null, 2);
}
