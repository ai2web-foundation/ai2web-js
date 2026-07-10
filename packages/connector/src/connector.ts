// Agent-side connector orchestration: discover sites via the Discovery Network,
// describe them, negotiate, and expose their capabilities as tools. This is the
// "we own both sides" piece - it needs no vendor to adopt ai2w, only to allow
// third-party MCP connectors (Claude/ChatGPT already do).

import { discover, negotiate, type Manifest, type AgentSupports, type NegotiationResult } from "@ai2web/core";
import { manifestToMcpTools, type McpToolDef } from "@ai2web/mcp-bridge";

export interface SiteRef {
  id: string;
  name: string;
  url: string;
  type: string;
  capabilities: string[];
  endpoints: { manifest: string; mcp?: string };
}

export interface SiteQuery {
  q?: string;
  capability?: string;
  category?: string;
  type?: string;
}

export interface DirectoryClient {
  search(query: SiteQuery): Promise<SiteRef[]>;
}

/** HTTP client for a running Discovery Network service. */
export function httpDirectory(baseUrl: string, fetchImpl: typeof fetch = fetch): DirectoryClient {
  return {
    async search(query) {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) if (v) p.set(k, String(v));
      const res = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/sites?${p}`);
      const json = (await res.json()) as { sites: SiteRef[] };
      return json.sites ?? [];
    },
  };
}

export async function findSites(dir: DirectoryClient, query: SiteQuery): Promise<SiteRef[]> {
  return dir.search(query);
}

/** Fetch a site's full manifest (via /ai2w with well-known fallback). */
export async function describeSite(siteOrUrl: SiteRef | string): Promise<Manifest> {
  const url = typeof siteOrUrl === "string" ? siteOrUrl : siteOrUrl.url;
  const { manifest } = await discover(url);
  return manifest;
}

export interface SitePlan {
  negotiation: NegotiationResult;
  tools: McpToolDef[];
}

/** Given a manifest and the agent's supported set, negotiate and produce the callable toolset. */
export function planForAgent(manifest: Manifest, agent: AgentSupports): SitePlan {
  return {
    negotiation: negotiate(manifest, agent),
    tools: manifestToMcpTools(manifest),
  };
}
