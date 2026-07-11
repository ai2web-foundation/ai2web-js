# @ai2web/connector

The **agent side** of AI2Web - an MCP server you load into Claude (custom connector) or ChatGPT (App via Apps SDK). It fronts the [Discovery Network](https://github.com/ai2web-foundation/ai2web-directory) so an assistant can find AI-ready sites and act on them, with **no vendor needing to adopt `ai2w`** - only to allow third-party MCP connectors (Claude and ChatGPT already do).

This is the "we own both sides" piece that defeats the cold-start problem.

## Tools it gives the assistant

| Tool | Does |
|---|---|
| `find_sites` | Search the Discovery Network by capability / type / text. |
| `describe_site` | Fetch a site's manifest + negotiate the capabilities/tools available to you. |
| `call_site_action` | Call a site's declared action. Approval-gated actions return a preview, never auto-execute. |

## Use as an MCP server

The package ships a runnable stdio MCP server (bin `ai2web-connector`). It needs
`@modelcontextprotocol/sdk` installed and an `AI2WEB_DIRECTORY` pointing at a deployed
[Discovery Network](https://github.com/ai2web-foundation/ai2web-directory).

Run it directly:

```bash
AI2WEB_DIRECTORY=https://directory.ai2web.dev npx @ai2web/connector
```

Add it to **Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ai2web": {
      "command": "npx",
      "args": ["-y", "@ai2web/connector"],
      "env": { "AI2WEB_DIRECTORY": "https://directory.ai2web.dev" }
    }
  }
}
```

In **Claude.ai / ChatGPT** you can instead add the hosted remote connector (a Cloudflare
Worker exposing `/mcp`) as a custom connector; see the `ai2web-cloud` repo.

### Configuration

| Env | Purpose | Default |
|---|---|---|
| `AI2WEB_DIRECTORY` | URL of the Discovery Network the connector queries | `https://directory.ai2web.dev` |

### Tools

Once connected, the assistant gets three tools: `find_sites`, `describe_site`, and
`call_site_action` (approval-gated actions return a preview instead of executing).

## Verified

The full discover → describe → negotiate → act loop (with approval gating) is proven in-process by `ai2web-js/scripts/spike.ts`. The stdio entrypoint (`src/stdio.ts`) starts this server over stdio for local MCP clients.
