// Pure mapping: AI2Web manifest -> MCP tool definitions. No SDK dependency, and only
// type-level imports from @ai2web/core, so the zero-build strip-types harness can run it
// directly. Each declared action becomes a callable MCP tool; agent_service intents and
// a discovery tool are added so an assistant can explore the site. Execution (and the
// RFC-0006 §3 security contract) lives in @ai2web/core `executeOperation`, shared by
// every adapter.

import type { Manifest, Risk } from "@ai2web/core";

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** How the bridge should invoke this tool against the site. */
  invoke: {
    method: string;
    url: string;
    requires_auth: boolean;
    requires_user_approval: boolean;
    risk: Risk;
  };
}

function resolveUrl(endpoint: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  // Collapse leading slashes so a protocol-relative "//attacker/x" cannot swap the host.
  const path = endpoint.replace(/^\/+/, "/");
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

export interface ToolsOptions {
  /** Absolute base URL of the site; defaults to manifest.site.url. */
  baseUrl?: string;
}

export function manifestToMcpTools(m: Manifest, opts: ToolsOptions = {}): McpToolDef[] {
  const baseUrl = opts.baseUrl ?? m.site?.url ?? "";
  const tools: McpToolDef[] = [];

  for (const a of m.actions ?? []) {
    tools.push({
      name: a.name,
      description:
        a.description +
        (a.requires_user_approval ? " (requires user approval)" : "") +
        (a.requires_auth ? " (requires authentication)" : ""),
      inputSchema: a.input_schema ?? { type: "object" },
      invoke: {
        method: a.method,
        url: resolveUrl(a.endpoint, baseUrl),
        requires_auth: a.requires_auth,
        requires_user_approval: a.requires_user_approval,
        risk: a.risk,
      },
    });
  }

  // Agent-service intents that aren't already actions -> a single agent tool.
  if (m.agent_service?.enabled && m.agent_service.endpoint) {
    tools.push({
      name: "ask_site_agent",
      description: `Ask this site's AI agent. Supported intents: ${(m.agent_service.supported_intents ?? []).join(", ")}.`,
      inputSchema: {
        type: "object",
        properties: { intent: { type: "string" }, message: { type: "string" } },
        required: ["message"],
      },
      invoke: {
        method: "POST",
        url: resolveUrl(m.agent_service.endpoint, baseUrl),
        requires_auth: false,
        requires_user_approval: false,
        risk: "low",
      },
    });
  }

  return tools;
}
