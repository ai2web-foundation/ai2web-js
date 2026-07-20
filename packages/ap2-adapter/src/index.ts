// @ai2web/ap2-adapter - drive an AI2Web site's advertised AP2 (Agent Payments Protocol, Google)
// merchant transport. The pure mapping lives in ap2.ts; here we execute an operation through
// @ai2web/core `executeOperation`, so `settle_payment` always previews for approval before any
// payment call, credentials stay same-origin, and targets are SSRF-checked (RFC-0006 §3) -
// identically to the ACP, MCP and GraphQL adapters.

import type { Manifest, ExecuteOptions } from "@ai2web/core";
import { executeOperation } from "@ai2web/core";
import { manifestToAp2, resolveAp2Operation, type Ap2OperationName, type Ap2Options } from "./ap2.js";

export {
  manifestToAp2,
  resolveAp2Operation,
  buildIntentMandate,
  type Ap2Adapter,
  type Ap2Operation,
  type Ap2OperationName,
  type Ap2Options,
  type Ap2Endpoints,
  type IntentMandate,
  type IntentMandateInput,
} from "./ap2.js";

export type Ap2AdapterOptions = Ap2Options & Omit<ExecuteOptions, "siteOrigin"> & {
  /** Origin credentials are scoped to; defaults to the manifest's site.url origin. */
  siteOrigin?: string;
};

/** Run one AP2 merchant operation by name under the full adapter contract. */
export function runAp2Operation(
  m: Manifest,
  name: Ap2OperationName,
  args: Record<string, unknown>,
  opts: Ap2AdapterOptions = {},
): Promise<unknown> {
  const adapter = manifestToAp2(m);
  if (!adapter.enabled) throw new Error("ai2w: site does not advertise the AP2 transport");
  const op = adapter.operations.find((o) => o.name === name);
  if (!op) throw new Error(`ai2w: unknown AP2 operation '${name}'`);

  const operation = resolveAp2Operation(op, m, args, opts);
  const siteOrigin = opts.siteOrigin ?? (m.site?.url ? new URL(m.site.url).origin : "");
  return executeOperation(operation, args, { siteOrigin, authToken: opts.authToken, fetchImpl: opts.fetchImpl });
}
