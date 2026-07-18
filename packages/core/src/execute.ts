// The one guarded executor every transport adapter shares. This is where the
// RFC-0006 §3 adapter contract is enforced ONCE, so MCP, GraphQL, ACP and any
// future adapter cannot drift on the security semantics:
//   §3.2 preserve requires_auth / requires_user_approval / risk end to end;
//   §3.3 preview when approval is required OR risk is `high` (the `high` rule holds
//        even if the manifest declares approval:false - anti-under-declaration);
//   §3.4 never send credentials to a different origin than the token's issuing origin;
//   §3.5 validate the outbound target as a safe public host before fetching.
// An `Operation` is the transport-neutral, executable projection of a capability:
// the same shape MCP tools, GraphQL fields and ACP checkout steps all reduce to.

import { assertSafePublicUrl, sameOrigin, safeFetch } from "./safety.js";
import type { Risk } from "./types.js";

export interface Operation {
  /** Stable identifier used in previews and errors. */
  name: string;
  method: string;
  /** Absolute target URL (already resolved against the site base). */
  url: string;
  requires_auth: boolean;
  requires_user_approval: boolean;
  risk: Risk;
}

export interface ExecuteOptions {
  /** Origin the credential is scoped to; credentials are NEVER sent elsewhere. */
  siteOrigin: string;
  /** Bearer token (or resolver) for authenticated operations. */
  authToken?: string | (() => string | Promise<string>);
  /** Override fetch (tests / non-global-fetch runtimes). */
  fetchImpl?: typeof fetch;
}

export interface Preview {
  preview: true;
  action: string;
  risk: Risk;
  message: string;
  proposed: unknown;
}

/** RFC-0006 §3.3 / RFC-0003 §4.4 / RFC-0014: preview iff approval is required OR risk is
 * `high` or `critical`. The high/critical rule holds even if the manifest declares
 * `requires_user_approval: false`, defending against an under-declared destructive action. */
export function needsApproval(op: { requires_user_approval: boolean; risk: Risk }): boolean {
  return op.requires_user_approval || op.risk === "high" || op.risk === "critical";
}

export function isPreview(x: unknown): x is Preview {
  return typeof x === "object" && x !== null && (x as { preview?: unknown }).preview === true;
}

/**
 * Execute one operation under the full adapter contract. Returns a `Preview`
 * (no network call) when approval is required; otherwise fetches and returns JSON.
 * Throws on a cross-origin credential attempt or an unsafe target.
 */
export async function executeOperation(op: Operation, args: unknown, opts: ExecuteOptions): Promise<unknown> {
  if (needsApproval(op)) {
    return {
      preview: true,
      action: op.name,
      risk: op.risk,
      message: "This action requires explicit user approval before execution.",
      proposed: args,
    } satisfies Preview;
  }

  assertSafePublicUrl(op.url); // §3.5 SSRF guard (safeFetch re-checks every redirect hop too)

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (op.requires_auth && opts.authToken) {
    // §3.4: a malicious manifest could point the URL at an attacker; refuse to
    // attach the token unless the target shares the credential's issuing origin.
    // safeFetch additionally strips the header if a redirect later crosses origin.
    if (!sameOrigin(op.url, opts.siteOrigin)) {
      throw new Error(`ai2w: refusing to send credentials cross-origin (${op.url} is not ${opts.siteOrigin})`);
    }
    const token = typeof opts.authToken === "function" ? await opts.authToken() : opts.authToken;
    headers.authorization = `Bearer ${token}`;
  }
  const res = await safeFetch(
    op.url,
    { method: op.method, headers, body: op.method === "GET" ? undefined : JSON.stringify(args ?? {}) },
    { fetchImpl: opts.fetchImpl },
  );
  return res.json();
}
