# @ai2web/mcp-bridge

Expose an [AI2Web](https://ai2web.dev) site's declared capabilities as an **MCP server**, usable in Claude and ChatGPT today. Each declared action becomes a callable MCP tool; the site's `agent_service` becomes a single agent tool.

Execution runs through the shared guarded executor in `@ai2web/core`, so approval gating (preview on high-risk or approval-required actions), the same-origin credential rule, and the SSRF guard are enforced (RFC-0006 section 3).

## Install

```bash
npm install @ai2web/mcp-bridge @ai2web/core @modelcontextprotocol/sdk
```

## Use

```js
import { manifestToMcpTools, createMcpServer } from "@ai2web/mcp-bridge";
import { discover } from "@ai2web/core";

const { manifest } = await discover("https://some-ai2web-site.com");

// Pure mapping (no SDK needed) - inspect the tools a manifest yields
const tools = manifestToMcpTools(manifest);

// Or build a live MCP server (needs @modelcontextprotocol/sdk)
const server = await createMcpServer(manifest, { siteOrigin: manifest.site.url });
```

Part of [AI2Web](https://github.com/ai2web-foundation).
