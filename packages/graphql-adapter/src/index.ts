// @ai2web/graphql-adapter - expose an AI2Web site's declared capabilities as a GraphQL
// schema. The pure mapping lives in schema.ts; here we build resolvers that route every
// field through @ai2web/core `executeOperation`, so approval gating, the same-origin
// credential rule and the SSRF guard (RFC-0006 §3) are enforced identically to the MCP
// and ACP adapters. Bring your own GraphQL server: pass `sdl` + `resolvers` to
// makeExecutableSchema (with a JSON scalar such as graphql-type-json).

import type { Manifest, ExecuteOptions } from "@ai2web/core";
import { executeOperation } from "@ai2web/core";
import { manifestToGraphQL, type GraphQLOptions, type GraphQLField } from "./schema.js";

export {
  manifestToGraphQL,
  type GraphQLField,
  type GraphQLSchema,
  type GraphQLOptions,
} from "./schema.js";

export type GraphQLAdapterOptions = GraphQLOptions & Omit<ExecuteOptions, "siteOrigin"> & {
  /** Origin credentials are scoped to; defaults to the manifest's site.url origin. */
  siteOrigin?: string;
};

type ResolverFn = (parent: unknown, args: { input?: unknown }) => Promise<unknown>;
export interface GraphQLResolvers {
  Query: Record<string, ResolverFn>;
  Mutation?: Record<string, ResolverFn>;
}

/** Invoke a single mapped field by name under the full adapter contract. */
export function runGraphQLField(
  fields: GraphQLField[],
  name: string,
  input: unknown,
  opts: ExecuteOptions,
): Promise<unknown> {
  const field = fields.find((f) => f.name === name);
  if (!field) throw new Error(`ai2w: unknown GraphQL field '${name}'`);
  return executeOperation(field.operation, input, opts);
}

/** Build { sdl, resolvers } ready to hand to a GraphQL server. */
export function createGraphQLAdapter(m: Manifest, opts: GraphQLAdapterOptions = {}) {
  const { sdl, fields } = manifestToGraphQL(m, opts);
  const siteOrigin = opts.siteOrigin ?? (m.site?.url ? new URL(m.site.url).origin : "");
  const exec: ExecuteOptions = { siteOrigin, authToken: opts.authToken, fetchImpl: opts.fetchImpl };

  const resolvers: GraphQLResolvers = {
    Query: {
      ai2w_capabilities: async () => m.capabilities ?? {},
    },
  };
  for (const f of fields) {
    const fn: ResolverFn = (_parent, args) => executeOperation(f.operation, args?.input, exec);
    if (f.kind === "query") resolvers.Query[f.name] = fn;
    else (resolvers.Mutation ??= {})[f.name] = fn;
  }

  return { sdl, fields, resolvers };
}
