// AI2Web (ai2w) capability model - TypeScript types. Mirrors ai2web-spec/spec/ai2w-v0.1.md.

export type Risk = "low" | "medium" | "high";

export interface Site {
  name: string;
  url: string;
  type: string; // ecommerce | saas | publisher | services | booking | government | education | healthcare | other
  description?: string;
  jurisdiction?: string;
  languages?: string[];
  logo?: string;
}

export interface Identity {
  legal_name?: string;
  privacy_policy?: string;
  terms?: string;
  support_url?: string;
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
