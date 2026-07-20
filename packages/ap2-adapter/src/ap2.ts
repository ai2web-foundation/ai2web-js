// Pure mapping: AI2Web manifest -> AP2 (Agent Payments Protocol, Google) merchant operations.
// AP2 is a mandate-based checkout a site advertises under transports.ap2: the merchant signs a
// Cart Mandate for a buyer agent's Intent Mandate, then settles a user-signed Payment Mandate.
// AI2Web does not define payment; this adapter presents the AP2 merchant vocabulary to an agent
// and routes it through @ai2web/core `executeOperation`, so `settle_payment` stays approval-gated
// (RFC-0006 §3.3/§4 "purchase/payment MUST remain approval-gated"). Type-only imports from
// @ai2web/core keep this runnable under the zero-build harness.

import type { Manifest, Operation, Risk } from "@ai2web/core";

export type Ap2OperationName =
  | "get_agent_card"
  | "get_jwks"
  | "create_cart"
  | "settle_payment";

export interface Ap2Operation {
  name: Ap2OperationName;
  method: string;
  /** Which transports.ap2 field carries this operation's endpoint. */
  endpointKey: "agent_card" | "jwks" | "cart" | "payment";
  /** Fallback path if the manifest omits the field. */
  defaultPath: string;
  risk: Risk;
  requires_auth: boolean;
  requires_user_approval: boolean;
  description: string;
}

export interface Ap2Endpoints {
  agent_card: string;
  jwks: string;
  cart: string;
  payment: string;
}

export interface Ap2Adapter {
  enabled: boolean;
  /** AP2 spec version the site advertises (e.g. "0.2.0"). */
  version?: string;
  /** The AP2 A2A extension URI the site advertises. */
  extension?: string;
  endpoints?: Ap2Endpoints;
  operations: Ap2Operation[];
}

export interface Ap2Options {
  baseUrl?: string;
}

/** The fixed AP2 merchant vocabulary. `settle_payment` is the money step: high risk and
 *  approval-gated so it always previews before any network call. */
const AP2_OPERATIONS: Ap2Operation[] = [
  { name: "get_agent_card", method: "GET", endpointKey: "agent_card", defaultPath: "/ai2w/ap2/agent-card", risk: "low", requires_auth: false, requires_user_approval: false, description: "Fetch the merchant's A2A agent card (declares the AP2 extension)." },
  { name: "get_jwks", method: "GET", endpointKey: "jwks", defaultPath: "/ai2w/ap2/jwks", risk: "low", requires_auth: false, requires_user_approval: false, description: "Fetch the merchant's JWKS to verify the Cart Mandate signature." },
  { name: "create_cart", method: "POST", endpointKey: "cart", defaultPath: "/ai2w/ap2/cart", risk: "low", requires_auth: false, requires_user_approval: false, description: "Send an Intent Mandate; receive a merchant-signed Cart Mandate." },
  { name: "settle_payment", method: "POST", endpointKey: "payment", defaultPath: "/ai2w/ap2/payment", risk: "high", requires_auth: false, requires_user_approval: true, description: "Send a Payment Mandate to settle the order (requires explicit user approval)." },
];

interface Ap2Transport {
  enabled?: boolean;
  version?: string;
  extension?: string;
  agent_card?: string;
  jwks?: string;
  cart?: string;
  payment?: string;
}

function ap2Transport(m: Manifest): Ap2Transport | undefined {
  const ap2 = (m.transports as Record<string, unknown> | undefined)?.ap2 as Ap2Transport | undefined;
  if (!ap2?.enabled) return undefined;
  return ap2;
}

function endpointsOf(t: Ap2Transport): Ap2Endpoints {
  return {
    agent_card: t.agent_card ?? "/ai2w/ap2/agent-card",
    jwks: t.jwks ?? "/ai2w/ap2/jwks",
    cart: t.cart ?? "/ai2w/ap2/cart",
    payment: t.payment ?? "/ai2w/ap2/payment",
  };
}

/** Present the AP2 merchant operations iff the site advertises the AP2 transport. */
export function manifestToAp2(m: Manifest): Ap2Adapter {
  const t = ap2Transport(m);
  if (!t) return { enabled: false, operations: [] };
  return {
    enabled: true,
    version: t.version,
    extension: t.extension,
    endpoints: endpointsOf(t),
    operations: AP2_OPERATIONS.map((o) => ({ ...o })),
  };
}

function joinUrl(baseUrl: string, endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `${baseUrl.replace(/\/+$/, "")}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
}

/**
 * Resolve one AP2 operation into a concrete, executable core `Operation`, taking the endpoint
 * from the advertised transports.ap2 block. Pure - no network, no core value dependency.
 */
export function resolveAp2Operation(op: Ap2Operation, m: Manifest, _args: Record<string, unknown>, opts: Ap2Options = {}): Operation {
  const t = ap2Transport(m);
  if (!t) throw new Error("ai2w: site does not advertise the AP2 transport");
  const baseUrl = opts.baseUrl ?? m.site?.url ?? "";
  const endpoint = endpointsOf(t)[op.endpointKey];
  return {
    name: op.name,
    method: op.method,
    url: joinUrl(baseUrl, endpoint),
    requires_auth: op.requires_auth,
    requires_user_approval: op.requires_user_approval,
    risk: op.risk,
  };
}

/** An AP2 IntentMandate (classic v0.2.0 shape), what an agent sends to `create_cart`. */
export interface IntentMandate {
  natural_language_description: string;
  intent_expiry: string;
  user_cart_confirmation_required?: boolean;
  requires_refundability?: boolean;
  merchants?: string[];
  skus?: string[];
  /** Multi-item / quantity carts (an AI2Web extension the merchant surface accepts). */
  items?: Array<{ sku?: string; product_id?: number; quantity?: number }>;
}

export interface IntentMandateInput {
  description: string;
  /** Seconds until the intent expires (default 900). */
  expiresInSeconds?: number;
  merchants?: string[];
  skus?: string[];
  items?: Array<{ sku?: string; product_id?: number; quantity?: number }>;
  requiresRefundability?: boolean;
  /** Whether the user must confirm the cart before purchase (default true). */
  userCartConfirmationRequired?: boolean;
  /** Injectable clock for deterministic tests; defaults to Date.now(). */
  now?: number;
}

/** Build a well-formed AP2 IntentMandate to POST to `create_cart`. Pure. */
export function buildIntentMandate(input: IntentMandateInput): IntentMandate {
  const now = input.now ?? Date.now();
  const ttl = input.expiresInSeconds ?? 900;
  const intent: IntentMandate = {
    natural_language_description: input.description,
    intent_expiry: new Date(now + ttl * 1000).toISOString(),
    user_cart_confirmation_required: input.userCartConfirmationRequired ?? true,
  };
  if (input.merchants?.length) intent.merchants = input.merchants;
  if (input.skus?.length) intent.skus = input.skus;
  if (input.items?.length) intent.items = input.items;
  if (input.requiresRefundability) intent.requires_refundability = true;
  return intent;
}
