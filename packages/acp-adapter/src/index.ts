// @ai2web/acp-adapter - drive an AI2Web site's advertised ACP checkout transport
// (RFC-0005 Profile 1). The pure mapping lives in acp.ts; here we execute an operation
// through @ai2web/core `executeOperation`, so `complete_checkout_session` always previews
// for approval before any payment call, credentials stay same-origin, and targets are
// SSRF-checked (RFC-0006 §3) - identically to the MCP and GraphQL adapters.

import type { Manifest, ExecuteOptions } from "@ai2web/core";
import { executeOperation } from "@ai2web/core";
import { manifestToAcp, resolveAcpOperation, type AcpOperationName, type AcpOptions } from "./acp.js";

export {
  manifestToAcp,
  resolveAcpOperation,
  type AcpAdapter,
  type AcpOperation,
  type AcpOperationName,
  type AcpOptions,
} from "./acp.js";

export type AcpAdapterOptions = AcpOptions & Omit<ExecuteOptions, "siteOrigin"> & {
  /** Origin credentials are scoped to; defaults to the manifest's site.url origin. */
  siteOrigin?: string;
};

/** Run one ACP checkout operation by name under the full adapter contract. */
export function runAcpOperation(
  m: Manifest,
  name: AcpOperationName,
  args: Record<string, unknown>,
  opts: AcpAdapterOptions = {},
): Promise<unknown> {
  const adapter = manifestToAcp(m);
  if (!adapter.enabled) throw new Error("ai2w: site does not advertise the ACP checkout transport");
  const op = adapter.operations.find((o) => o.name === name);
  if (!op) throw new Error(`ai2w: unknown ACP operation '${name}'`);

  const operation = resolveAcpOperation(op, m, args, opts);
  const siteOrigin = opts.siteOrigin ?? (m.site?.url ? new URL(m.site.url).origin : "");
  return executeOperation(operation, args, { siteOrigin, authToken: opts.authToken, fetchImpl: opts.fetchImpl });
}
