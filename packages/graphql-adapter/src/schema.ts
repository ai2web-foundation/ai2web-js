// Pure mapping: AI2Web manifest -> GraphQL schema (SDL) + executable fields.
// Type-only imports from @ai2web/core so the zero-build harness can run this directly.
// Each declared action becomes a field carrying an `Operation`; GET actions are Query
// fields (reads), everything else is a Mutation field. Nothing the manifest does not
// declare is exposed (RFC-0006 §3.1). Execution + the security contract are enforced by
// @ai2web/core `executeOperation`, invoked by the resolvers in index.ts.

import type { Manifest, Operation, Risk } from "@ai2web/core";

export interface GraphQLField {
  /** Sanitised GraphQL field name. */
  name: string;
  kind: "query" | "mutation";
  description: string;
  /** The executable, guarded operation this field maps to. */
  operation: Operation;
}

export interface GraphQLSchema {
  sdl: string;
  fields: GraphQLField[];
}

export interface GraphQLOptions {
  baseUrl?: string;
}

function resolveUrl(endpoint: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const path = endpoint.replace(/^\/+/, "/");
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Coerce an action name into a valid, unique GraphQL field name. */
function gqlName(raw: string, taken: Set<string>): string {
  let n = raw.replace(/[^_0-9A-Za-z]/g, "_");
  if (!/^[_A-Za-z]/.test(n)) n = `_${n}`;
  let candidate = n;
  let i = 2;
  while (taken.has(candidate)) candidate = `${n}_${i++}`;
  taken.add(candidate);
  return candidate;
}

function describe(base: string, risk: Risk, auth: boolean, approval: boolean): string {
  const notes = [`risk: ${risk}`];
  if (auth) notes.push("requires authentication");
  if (approval || risk === "high") notes.push("requires user approval");
  // GraphQL block strings cannot contain a bare triple quote.
  return `${base.replace(/"""/g, '\\"\\"\\"')} (${notes.join("; ")})`;
}

export function manifestToGraphQL(m: Manifest, opts: GraphQLOptions = {}): GraphQLSchema {
  const baseUrl = opts.baseUrl ?? m.site?.url ?? "";
  const taken = new Set<string>(["ai2w_capabilities"]);
  const fields: GraphQLField[] = [];

  for (const a of m.actions ?? []) {
    const op: Operation = {
      name: a.name,
      method: a.method,
      url: resolveUrl(a.endpoint, baseUrl),
      requires_auth: a.requires_auth,
      requires_user_approval: a.requires_user_approval,
      risk: a.risk,
    };
    fields.push({
      name: gqlName(a.name, taken),
      kind: a.method === "GET" ? "query" : "mutation",
      description: describe(a.description, a.risk, a.requires_auth, a.requires_user_approval),
      operation: op,
    });
  }

  if (m.agent_service?.enabled && m.agent_service.endpoint) {
    fields.push({
      name: gqlName("ask_site_agent", taken),
      kind: "mutation",
      description: describe(
        `Ask this site's AI agent. Intents: ${(m.agent_service.supported_intents ?? []).join(", ")}.`,
        "low",
        false,
        false,
      ),
      operation: {
        name: "ask_site_agent",
        method: "POST",
        url: resolveUrl(m.agent_service.endpoint, baseUrl),
        requires_auth: false,
        requires_user_approval: false,
        risk: "low",
      },
    });
  }

  return { sdl: buildSDL(m, fields), fields };
}

function fieldSDL(f: GraphQLField): string {
  return `  """${f.description}"""\n  ${f.name}(input: JSON): JSON`;
}

function buildSDL(m: Manifest, fields: GraphQLField[]): string {
  const queries = fields.filter((f) => f.kind === "query");
  const mutations = fields.filter((f) => f.kind === "mutation");
  const parts: string[] = [
    `"""AI2Web GraphQL adapter for ${m.site?.name ?? "site"} - generated from the ai2w manifest."""`,
    "scalar JSON",
    "",
    "type Query {",
    '  """Public capability metadata declared by this site (no auth)."""',
    "  ai2w_capabilities: JSON",
    ...queries.map(fieldSDL),
    "}",
  ];
  if (mutations.length) {
    parts.push("", "type Mutation {", ...mutations.map(fieldSDL), "}");
  }
  return parts.join("\n") + "\n";
}
