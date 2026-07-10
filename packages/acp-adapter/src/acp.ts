// Pure mapping: AI2Web manifest -> ACP (Agentic Commerce Protocol) checkout operations.
// ACP is RFC-0005 Profile 1: a checkout *transport* a site advertises under
// transports.acp. AI2Web does not define checkout; this adapter presents the ACP
// checkout-session vocabulary to an agent and routes it through @ai2web/core
// `executeOperation`, so the payment step stays approval-gated (RFC-0005 §3.3,
// RFC-0006 §3.3/§4 "purchase/payment MUST remain approval-gated"). Type-only imports
// from @ai2web/core keep this runnable under the zero-build harness.

import type { Manifest, Operation, Risk } from "@ai2web/core";

export type AcpOperationName =
  | "create_checkout_session"
  | "get_checkout_session"
  | "update_checkout_session"
  | "complete_checkout_session"
  | "cancel_checkout_session";

export interface AcpOperation {
  name: AcpOperationName;
  method: string;
  /** Path relative to the advertised ACP endpoint; may contain :session_id. */
  path: string;
  risk: Risk;
  requires_auth: boolean;
  requires_user_approval: boolean;
  description: string;
}

export interface AcpAdapter {
  enabled: boolean;
  /** The advertised ACP endpoint (relative or absolute), if any. */
  endpoint?: string;
  operations: AcpOperation[];
}

export interface AcpOptions {
  baseUrl?: string;
}

// The fixed ACP checkout-session vocabulary. `complete` is the money step: high risk and
// approval-gated so it always previews before any network call.
const ACP_OPERATIONS: AcpOperation[] = [
  { name: "create_checkout_session", method: "POST", path: "/checkout_sessions", risk: "low", requires_auth: false, requires_user_approval: false, description: "Create a checkout session from line items." },
  { name: "get_checkout_session", method: "GET", path: "/checkout_sessions/:session_id", risk: "low", requires_auth: false, requires_user_approval: false, description: "Retrieve a checkout session (totals, status)." },
  { name: "update_checkout_session", method: "POST", path: "/checkout_sessions/:session_id", risk: "medium", requires_auth: false, requires_user_approval: false, description: "Update line items, shipping or buyer details." },
  { name: "complete_checkout_session", method: "POST", path: "/checkout_sessions/:session_id/complete", risk: "high", requires_auth: false, requires_user_approval: true, description: "Complete the purchase and take payment (requires explicit user approval)." },
  { name: "cancel_checkout_session", method: "POST", path: "/checkout_sessions/:session_id/cancel", risk: "medium", requires_auth: false, requires_user_approval: false, description: "Cancel an in-progress checkout session." },
];

function acpEndpoint(m: Manifest): string | undefined {
  const acp = (m.transports as Record<string, unknown> | undefined)?.acp as
    | { enabled?: boolean; endpoint?: string }
    | undefined;
  if (!acp?.enabled) return undefined;
  return acp.endpoint ?? "/ai2w/acp";
}

/** Present the ACP checkout operations iff the site advertises the ACP transport. */
export function manifestToAcp(m: Manifest): AcpAdapter {
  const endpoint = acpEndpoint(m);
  if (!endpoint) return { enabled: false, operations: [] };
  return { enabled: true, endpoint, operations: ACP_OPERATIONS.map((o) => ({ ...o })) };
}

function joinUrl(baseUrl: string, endpoint: string, path: string): string {
  const abs = /^https?:\/\//i.test(endpoint) ? endpoint : `${baseUrl.replace(/\/+$/, "")}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  return `${abs.replace(/\/+$/, "")}${path}`;
}

/**
 * Resolve one ACP operation into a concrete, executable core `Operation`, substituting
 * :session_id from args. Pure - no network, no core value dependency.
 */
export function resolveAcpOperation(op: AcpOperation, m: Manifest, args: Record<string, unknown>, opts: AcpOptions = {}): Operation {
  const endpoint = acpEndpoint(m);
  if (!endpoint) throw new Error("ai2w: site does not advertise the ACP checkout transport");
  const baseUrl = opts.baseUrl ?? m.site?.url ?? "";

  let path = op.path;
  if (path.includes(":session_id")) {
    const id = args?.session_id;
    if (typeof id !== "string" || !id) throw new Error(`ai2w: ACP ${op.name} requires 'session_id'`);
    path = path.replace(":session_id", encodeURIComponent(id));
  }

  return {
    name: op.name,
    method: op.method,
    url: joinUrl(baseUrl, endpoint, path),
    requires_auth: op.requires_auth,
    requires_user_approval: op.requires_user_approval,
    risk: op.risk,
  };
}
