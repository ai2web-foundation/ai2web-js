// Wire the mapped tools into an MCP server. Uses @modelcontextprotocol/sdk at runtime
// (optional peer dep); the pure mapping in tools.ts is what carries the logic/tests.

import type { Manifest } from "@ai2web/core";
import { executeOperation } from "@ai2web/core";
import { manifestToMcpTools, type McpToolDef, type ToolsOptions } from "./tools.js";

export interface BridgeOptions extends ToolsOptions {
  /** Bearer token (or resolver) for authenticated actions. */
  authToken?: string | (() => string | Promise<string>);
  /** Origin the token is scoped to; defaults to the manifest's site.url. Credentials
   *  are NEVER sent to a different origin (token-exfiltration guard). */
  siteOrigin?: string;
  /** Override fetch (tests / non-global-fetch runtimes). */
  fetchImpl?: typeof fetch;
}

/**
 * Invoke a mapped tool while enforcing the RFC-0006 §3.1 adapter rules:
 *   - approval by risk tier (independent of the manifest's self-declared flag);
 *   - SSRF guard on the target URL;
 *   - no cross-origin credential transmission.
 * Exported so the adapter-conformance harness can exercise the exact production logic.
 */
export async function invokeTool(tool: McpToolDef, args: unknown, opts: BridgeOptions & { siteOrigin: string }): Promise<unknown> {
  // The MCP adapter carries no security logic of its own: it projects the tool's
  // `invoke` metadata onto the shared, contract-enforcing executor (RFC-0006 §3),
  // exactly as the GraphQL and ACP adapters do.
  return executeOperation(
    { name: tool.name, ...tool.invoke },
    args,
    { siteOrigin: opts.siteOrigin, authToken: opts.authToken, fetchImpl: opts.fetchImpl },
  );
}

/**
 * Build an MCP server exposing the manifest's capabilities as tools.
 * Dynamically imports the SDK so this package builds without it installed.
 */
export async function createMcpServer(manifest: Manifest, opts: BridgeOptions = {}) {
  const tools = manifestToMcpTools(manifest, opts);
  const siteOrigin = opts.siteOrigin ?? manifest.site?.url ?? "";

  // Dynamic import via a variable specifier keeps the SDK an optional peer dependency
  // (TS won't try to resolve it at build time, so the package builds without it installed).
  const sdkSpecifier = "@modelcontextprotocol/sdk/server/mcp.js";
  const sdk = (await import(sdkSpecifier).catch(() => null)) as
    | { McpServer: new (info: { name: string; version: string }) => McpServerLike }
    | null;
  if (!sdk) {
    throw new Error(
      "@modelcontextprotocol/sdk is not installed. Install it, or use manifestToMcpTools() directly.",
    );
  }

  const server = new sdk.McpServer({ name: `ai2w:${manifest.site.name}`, version: manifest.version });
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.inputSchema, async (args: unknown) => {
      const result = await invokeTool(tool, args, { ...opts, siteOrigin });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });
  }
  return server;
}

// Minimal structural type for the SDK server we use (avoids a hard type dep).
interface McpServerLike {
  tool(
    name: string,
    description: string,
    schema: Record<string, unknown>,
    handler: (args: unknown) => Promise<{ content: { type: string; text: string }[] }>,
  ): void;
}
