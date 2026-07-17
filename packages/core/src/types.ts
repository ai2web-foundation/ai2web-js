// AI2Web (ai2w) capability model - TypeScript types. Mirrors the ai2web spec.

export type Risk = "low" | "medium" | "high" | "critical";

export interface Site {
  name: string;
  url: string;
  type: string; // ecommerce | saas | publisher | services | booking | government | education | healthcare | other
  description?: string;
  jurisdiction?: string;
  languages?: string[];
  logo?: string;
}

/** Agent-identity requirement + verification (RFC-0013). Design-first; verification reuses
 * HTTP Message Signatures (RFC 9421). Defaults keep anonymous access, so existing sites are unaffected. */
export interface AgentIdentity {
  required?: boolean;
  allow_anonymous?: boolean;
  methods?: ("http_message_signatures" | "oauth_client" | "attestation")[];
  min_level?: "anonymous" | "identified" | "verified";
}

export interface Identity {
  legal_name?: string;
  privacy_policy?: string;
  terms?: string;
  support_url?: string;
  agent?: AgentIdentity;
}

export interface CapabilityObject {
  enabled: boolean;
  endpoint?: string;
  [key: string]: unknown;
}

export type Capability = boolean | CapabilityObject;

/** Canonical module names. Extensions allowed via index signature. */
export interface Capabilities {
  content?: Capability;
  commerce?: Capability;
  actions?: Capability;
  events?: Capability;
  communication?: Capability;
  identity?: Capability;
  search?: Capability;
  agent?: Capability;
  booking?: Capability;
  services?: Capability;
  extensions?: Capability;
  [module: string]: Capability | undefined;
}

export interface Transports {
  rest?: { enabled: boolean; base?: string };
  mcp?: { enabled: boolean; endpoint?: string };
  feeds?: Record<string, string>;
  openapi?: { enabled: boolean; url?: string };
  [name: string]: unknown;
}

export type AuthMethod = "none" | "oauth2" | "signed_request" | "session" | "api_key";

export interface Auth {
  methods: AuthMethod[];
  oauth2?: {
    authorization_url?: string;
    token_url?: string;
    pkce?: boolean;
    scopes?: string[];
  };
}

export interface Consent {
  requires_user_approval_for?: string[];
}

/** How an action can be invoked (RFC-0014). An agent prefers the lowest `priority` it can use;
 * a `fallback_only` binding (e.g. redirect/html) is used only when nothing else is usable. */
export interface Binding {
  kind: "rest" | "mcp" | "openapi" | "graphql" | "redirect" | "html";
  ref: string;
  priority?: number;
  fallback_only?: boolean;
}

export interface Action {
  name: string;
  description: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  endpoint: string;
  requires_auth: boolean;
  requires_user_approval: boolean;
  risk: Risk;
  input_schema: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  /** Semantic identifier for the action's purpose (RFC-0014), e.g. "track_delivery". */
  intent?: string;
  /** Multiple ways to invoke this action, with priority + fallback (RFC-0014). */
  bindings?: Binding[];
}

export interface Events {
  endpoint?: string;
  subscribe?: string;
  delivery?: ("webhook" | "poll" | "sse")[];
  types?: string[];
}

export interface AgentService {
  enabled: boolean;
  endpoint?: string;
  supported_intents?: string[];
}

export interface RateLimit { requests: number; window_seconds: number; }

/** Enforced operational governance (RFC-0012). The manifest declares it; a conforming server enforces it. */
export interface Governance {
  rate_limits?: RateLimit & { per_action?: Record<string, RateLimit> };
  data_scope?: Record<string, string[]>;
  consent_mode?: Record<string, "none" | "preview" | "explicit" | "authenticated">;
  audit?: Record<string, string[]>;
}

/** Declarative acceptable-use signals (RFC-0012). Advisory; enforcement is out of band. */
export interface UsagePolicy {
  bulk_extraction?: boolean;
  price_monitoring?: boolean;
  content_reproduction?: boolean;
  model_training?: boolean;
}

/** Declarative legal/transparency metadata (RFC-0012). Aids to transparency, not compliance. */
export interface Legal {
  terms_url?: string;
  privacy_url?: string;
  jurisdiction?: string;
  ai_transparency?: boolean;
  ai_risk_classification?: "minimal" | "limited" | "high";
  data_processing_basis?: string;
  restricted_uses?: string[];
}

/** A trusted content/data source for grounding (RFC-0014). Advisory, read-only. */
export interface KnowledgeSource {
  id: string;
  name?: string;
  kind: "catalog" | "policy" | "faq" | "feed" | "index";
  ref: string;
  format?: string;
}

export interface Manifest {
  protocol: "ai2w";
  version: string;
  site: Site;
  identity?: Identity;
  capabilities: Capabilities;
  transports?: Transports;
  auth?: Auth;
  consent?: Consent;
  actions?: Action[];
  events?: Events;
  agent_service?: AgentService;
  rate_limits?: Record<string, unknown>;
  governance?: Governance;
  usage_policy?: UsagePolicy;
  legal?: Legal;
  knowledge?: KnowledgeSource[];
  contact?: { support?: string; security?: string };
  [ext: string]: unknown; // x-* extensions
}

export type ComplianceTier = "Invalid" | "Basic" | "Standard" | "Enterprise";

export interface Check {
  ok: boolean;
  points: number;
  label: string;
  hint: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  checks: Check[];
  score: number; // 0..100 - AI Readiness Score
  tier: ComplianceTier;
}
