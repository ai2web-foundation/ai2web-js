// @ai2web/nlweb-adapter - query an AI2Web site's advertised NLWeb (nlweb.ai) endpoint. The pure
// mapping lives in nlweb.ts; here we execute the `ask` query through @ai2web/core `executeOperation`
// so the target is SSRF-checked and credentials stay same-origin (RFC-0006 §3) - identically to the
// ACP, AP2, MCP and GraphQL adapters.

import type { Manifest, ExecuteOptions } from "@ai2web/core";
import { executeOperation } from "@ai2web/core";
import { manifestToNlweb, resolveNlwebOperation, type NlwebAskArgs, type NlwebOptions } from "./nlweb.js";

export {
  manifestToNlweb,
  resolveNlwebOperation,
  buildAskUrl,
  type NlwebAdapter,
  type NlwebOperation,
  type NlwebOperationName,
  type NlwebOptions,
  type NlwebAskArgs,
  type NlwebMode,
} from "./nlweb.js";

export type NlwebAdapterOptions = NlwebOptions & Omit<ExecuteOptions, "siteOrigin"> & {
  /** Origin credentials are scoped to; defaults to the manifest's site.url origin. */
  siteOrigin?: string;
};

/** Query the site's NLWeb `ask` endpoint under the full guarded adapter contract. */
export function askNlweb(m: Manifest, args: NlwebAskArgs, opts: NlwebAdapterOptions = {}): Promise<unknown> {
  const adapter = manifestToNlweb(m);
  if (!adapter.enabled) throw new Error("ai2w: site does not advertise the NLWeb transport");
  const op = adapter.operations.find((o) => o.name === "ask");
  if (!op) throw new Error("ai2w: NLWeb adapter has no 'ask' operation");

  const operation = resolveNlwebOperation(op, m, args, opts);
  const siteOrigin = opts.siteOrigin ?? (m.site?.url ? new URL(m.site.url).origin : "");
  // The query lives in the resolved URL; no request body for the GET.
  return executeOperation(operation, {}, { siteOrigin, authToken: opts.authToken, fetchImpl: opts.fetchImpl });
}
