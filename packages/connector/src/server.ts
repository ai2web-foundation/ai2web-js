// MCP server that fronts the Discovery Network. Load this as a custom connector in
// Claude / a ChatGPT App; it gives the assistant three tools to work the whole network.

import { assertSafePublicUrl } from "@ai2web/core";
import { httpDirectory, findSites, describeSite, planForAgent, type DirectoryClient } from "./connector.js";

export interface ConnectorOptions {
  directoryUrl?: string;
  directory?: DirectoryClient;
}

// Omit `capabilities` so negotiation defaults to the site's full set (the connector is a
// generic relay that understands every capability it is shown). An empty array would be
// kept by `??` and negotiate to zero capabilities.
const AGENT_SUPPORTS = { transports: ["mcp", "rest"], auth: ["oauth2", "none"] };

export async function createConnectorServer(opts: ConnectorOptions = {}) {
  const dir = opts.directory ?? httpDirectory(opts.directoryUrl ?? "http://localhost:4787");

  const sdkSpecifier = "@modelcontextprotocol/sdk/server/mcp.js";
  const sdk = (await import(sdkSpecifier).catch(() => null)) as
    | { McpServer: new (info: { name: string; version: string }) => McpServerLike }
    | null;
  if (!sdk) throw new Error("@modelcontextprotocol/sdk is not installed.");

  const server = new sdk.McpServer({ name: "ai2web-connector", version: "0.1.0" });

  server.tool(
    "find_sites",
    "Find AI-ready (AI2Web) websites by capability, category, type or free text.",
    { type: "object", properties: { q: { type: "string" }, capability: { type: "string" }, type: { type: "string" } } },
    async (args: { q?: string; capability?: string; type?: string }) => {
      const sites = await findSites(dir, args);
      return { content: [{ type: "text", text: JSON.stringify(sites) }] };
    },
  );

  server.tool(
    "describe_site",
    "Fetch a site's AI2Web manifest and the capabilities/tools it exposes to you.",
    { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
    async (args: { url: string }) => {
      const manifest = await describeSite(args.url);
      const plan = planForAgent(manifest, AGENT_SUPPORTS);
      return { content: [{ type: "text", text: JSON.stringify({ site: manifest.site, ...plan }) }] };
    },
  );

  server.tool(
    "call_site_action",
    "Call one of a site's declared actions. Approval-gated actions return a preview instead of executing.",
    { type: "object", properties: { url: { type: "string" }, action: { type: "string" }, input: { type: "object" } }, required: ["url", "action"] },
    async (args: { url: string; action: string; input?: unknown }) => {
      const manifest = await describeSite(args.url);
      const tool = planForAgent(manifest, AGENT_SUPPORTS).tools.find((t) => t.name === args.action);
      if (!tool) return { content: [{ type: "text", text: JSON.stringify({ error: "unknown_action" }) }] };
      // Client-side policy (RFC-0003 §4.4): preview when approval is required or risk is high
      // (the high rule holds even if the manifest declares approval:false). Medium respects the
      // flag, so authenticated reads (e.g. order tracking) execute without a needless prompt.
      if (tool.invoke.requires_user_approval || tool.invoke.risk === "high") {
        return { content: [{ type: "text", text: JSON.stringify({ preview: true, action: tool.name, risk: tool.invoke.risk, proposed: args.input }) }] };
      }
      assertSafePublicUrl(tool.invoke.url); // SSRF guard
      const res = await fetch(tool.invoke.url, {
        method: tool.invoke.method,
        headers: { "content-type": "application/json" },
        body: tool.invoke.method === "GET" ? undefined : JSON.stringify(args.input ?? {}),
      });
      return { content: [{ type: "text", text: await res.text() }] };
    },
  );

  return server;
}

interface McpServerLike {
  tool(name: string, description: string, schema: Record<string, unknown>, handler: (args: never) => Promise<{ content: { type: string; text: string }[] }>): void;
}
