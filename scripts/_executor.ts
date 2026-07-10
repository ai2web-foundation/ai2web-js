// Zero-build mirror of @ai2web/core `executeOperation`, for the strip-types harness.
// Node's type stripping does not rewrite `.js` specifiers to `.ts`, so execute.ts (which
// value-imports ./safety.js) cannot be loaded directly by a script. This mirror imports
// the REAL SSRF / same-origin guards from the leaf safety.ts (no cross-imports) and the
// TYPES from execute.ts (erased at strip time), so only the ~12-line orchestration is
// re-stated here. The real executeOperation ships in @ai2web/core and is typechecked by
// CI's build job; every adapter's runtime routes through it. Keep the two in lockstep.

import { assertSafePublicUrl, sameOrigin } from "../packages/core/src/safety.ts";
import type { Operation, ExecuteOptions } from "../packages/core/src/execute.ts";

export async function executeOperation(op: Operation, args: unknown, opts: ExecuteOptions): Promise<any> {
  if (op.requires_user_approval || op.risk === "high") {
    return { preview: true, action: op.name, risk: op.risk, message: "This action requires explicit user approval before execution.", proposed: args };
  }
  assertSafePublicUrl(op.url);
  const f = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (op.requires_auth && opts.authToken) {
    if (!sameOrigin(op.url, opts.siteOrigin)) {
      throw new Error(`ai2w: refusing to send credentials cross-origin (${op.url} is not ${opts.siteOrigin})`);
    }
    const token = typeof opts.authToken === "function" ? await opts.authToken() : opts.authToken;
    headers.authorization = `Bearer ${token}`;
  }
  const res = await (f as any)(op.url, { method: op.method, headers, body: op.method === "GET" ? undefined : JSON.stringify(args ?? {}) });
  return res.json();
}
