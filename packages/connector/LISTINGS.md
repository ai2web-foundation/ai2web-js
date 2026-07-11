# MCP directory listings

Copy-paste sources for submitting the AI2Web connector to MCP directories.

## Prerequisites (do these first, or listings will fail)

1. Publish `@ai2web/connector` (and its deps `@ai2web/core`, `@ai2web/mcp-bridge`) to npm.
2. Make the GitHub repo public.
3. Deploy the Discovery Network (`ai2web-directory`) and use its URL as `AI2WEB_DIRECTORY`
   (the default `https://directory.ai2web.dev` must resolve, or `find_sites` returns nothing).

## Reusable server card (for form-based directories)

**Name:** AI2Web Connector

**One-liner:** One MCP server that fronts the AI2Web Discovery Network so an assistant can find AI-ready websites and act on them.

**Description:** AI2Web lets a website describe its capabilities once in a manifest at `/ai2w`. This connector gives any MCP client three tools over the whole network of AI-ready sites: `find_sites` (search by capability, type or text), `describe_site` (fetch a site's manifest and the tools available), and `call_site_action` (call a declared action). Sensitive actions return a preview and require user approval before running.

**Install:** `npx @ai2web/connector` (env `AI2WEB_DIRECTORY`)

**Category:** Web / aggregators / automation

**Repository:** https://github.com/ai2web-foundation/ai2web-js

**Homepage:** https://ai2web.dev

**Tools:** find_sites, describe_site, call_site_action

## awesome-mcp-servers entry

Different lists use different emoji legends; adjust to the target list (commonly 📇 = TypeScript/JS, 🏠 = runs locally, ☁️ = cloud/remote).

```markdown
- [ai2web-foundation/ai2web-js](https://github.com/ai2web-foundation/ai2web-js) 📇 🏠 - Fronts the AI2Web Discovery Network so an assistant can find AI-ready websites and act on them (find_sites, describe_site, call_site_action), with approval-gating on sensitive actions.
```

## Claude Desktop config (for READMEs / submissions)

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

## Where to submit

- awesome-mcp-servers lists (GitHub README PR): add the entry above under a Web / automation section.
- Glama (glama.ai/mcp/servers): auto-crawls public GitHub; claim/submit if not indexed.
- mcp.so: use the Submit form with the repo URL + server card.
- PulseMCP (pulsemcp.com): use the submit/suggest flow with the server card.
- Smithery (smithery.ai): connect the repo; `smithery.yaml` is in this folder (may need to sit at repo root for a monorepo).
- modelcontextprotocol/servers: PR the community servers list per its contributing guide.

Submission flows change often; confirm the current button/form on each site.
