# @ai2web/connector

The **agent side** of AI2Web - an MCP server you load into Claude (custom connector) or ChatGPT (App via Apps SDK). It fronts the [Discovery Network](https://github.com/ai2web-foundation/ai2web-directory) so an assistant can find AI-ready sites and act on them, with **no vendor needing to adopt `ai2w`** - only to allow third-party MCP connectors (Claude and ChatGPT already do).

This is the "we own both sides" piece that defeats the cold-start problem.

## Tools it gives the assistant

| Tool | Does |
|---|---|
| `find_sites` | Search the Discovery Network by capability / type / text. |
| `describe_site` | Fetch a site's manifest + negotiate the capabilities/tools available to you. |
| `call_site_action` | Call a site's declared action. Approval-gated actions return a preview, never auto-execute. |

## Run

```bash
# needs @modelcontextprotocol/sdk installed
AI2WEB_DIRECTORY=http://localhost:4787 node dist/server.js
```

Then register it as a custom MCP connector in your assistant.

## Verified

The full discover → describe → negotiate → act loop (with approval gating) is proven in-process by `ai2web-js/scripts/spike.ts`. The only live-assistant step is registering this MCP server.
