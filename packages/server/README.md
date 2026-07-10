# @ai2web/server

A framework-agnostic route handler that serves an [AI2Web](https://ai2web.dev) site: the required `/.well-known/ai2w` discovery anchor, the canonical `/ai2w` manifest, capability negotiation, and your module/action routes. Ships Node and Cloudflare Workers adapters.

## Install

```bash
npm install @ai2web/server @ai2web/core
```

## Use

```js
import { nodeListener, cloudflareHandler } from "@ai2web/server";
import { ai2web } from "@ai2web/core";

const manifest = ai2web({ name: "Acme", url: "https://acme.example", type: "ecommerce" })
  .capability("content")
  .build();

const options = {
  manifest,
  modules: { content: (req) => ({ items: [] }) },
  actions: { check_stock: (req) => ({ in_stock: true }) },
};

// Node
import { createServer } from "node:http";
createServer(nodeListener(options)).listen(8787);

// Cloudflare Workers
export default cloudflareHandler(options);
```

`createAi2wHandler(options)` is also exported for use with any other runtime. Part of [AI2Web](https://github.com/ai2web-foundation).
