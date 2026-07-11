#!/usr/bin/env node
// Runnable stdio entrypoint for the AI2Web MCP connector: `npx @ai2web/connector`.
// Starts the connector over stdio so it can be loaded as a local MCP server in Claude
// Desktop and other MCP clients. Requires @modelcontextprotocol/sdk (peer dependency).
//
// Configuration (env):
//   AI2WEB_DIRECTORY  URL of the AI2Web Discovery Network to query.
//                     Defaults to https://directory.ai2web.dev.

import { createConnectorServer } from "./server.js";

async function main(): Promise<void> {
  const directoryUrl = process.env.AI2WEB_DIRECTORY || "https://directory.ai2web.dev";
  const server = await createConnectorServer({ directoryUrl });

  // Dynamic import via a variable specifier keeps the SDK an optional peer dependency
  // (the same pattern createConnectorServer uses for the server module).
  const stdioSpecifier = "@modelcontextprotocol/sdk/server/stdio.js";
  const mod = (await import(stdioSpecifier).catch(() => null)) as
    | { StdioServerTransport: new () => unknown }
    | null;
  if (!mod) {
    throw new Error("@modelcontextprotocol/sdk is not installed. Install it: npm i @modelcontextprotocol/sdk");
  }

  const transport = new mod.StdioServerTransport();
  await (server as unknown as { connect(t: unknown): Promise<void> }).connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(`ai2web-connector: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
