# @ai2web/nlweb-adapter

Query an [AI2Web](https://ai2web.dev) site's advertised **NLWeb** ([nlweb.ai](https://nlweb.ai)) endpoint. NLWeb turns a site's content into a natural-language, schema.org-flavoured query API (its `ask` endpoint) and exposes itself over MCP. This adapter presents that `ask` query and routes it through the shared guarded executor in `@ai2web/core`, so the target is SSRF-checked and credentials stay same-origin - identically to the ACP, AP2 and MCP adapters.

AI2Web does not define NLWeb; a site that runs (or projects) NLWeb advertises it under `transports.nlweb`, and this adapter lets an agent use it.

## Install

```bash
npm install @ai2web/nlweb-adapter @ai2web/core
```

## Use

```js
import { manifestToNlweb, askNlweb } from "@ai2web/nlweb-adapter";
import { discover } from "@ai2web/core";

const { manifest } = await discover("https://some-ai2web-site.com");

// Present the NLWeb query (only if the site advertises transports.nlweb)
const adapter = manifestToNlweb(manifest);

// Ask the site's NLWeb endpoint a natural-language question
const results = await askNlweb(manifest, { query: "red running shoes under $120", mode: "list" });
```

`transports.nlweb` is an AI2Web convention that points at the site's `/ask` (and optional `/mcp`) URLs, since NLWeb itself defines no discovery file.

Part of [AI2Web](https://github.com/ai2web-foundation).
