# @ai2web/core

The foundation of the [AI2Web](https://ai2web.dev) framework: the capability-model types, a fluent manifest **builder**, **validation** with AI Readiness scoring, the **discovery** client, capability **negotiation**, an embeddable **AI Readiness badge**, and the shared guarded **executor** (approval by risk tier, same-origin credentials, SSRF guard) that every AI2Web transport adapter routes through.

Works the same in TypeScript and plain JavaScript.

## Install

```bash
npm install @ai2web/core
```

## Use

```js
import { ai2web, validateManifest, discover, renderBadgeSvg } from "@ai2web/core";

// 1. Describe a site once
const manifest = ai2web({ name: "Acme", url: "https://acme.example", type: "ecommerce" })
  .capability("content")
  .capability("commerce", { checkout: true })
  .build();

// 2. Score its AI readiness
const result = validateManifest(manifest);
console.log(`${result.score}/100 (${result.tier})`);

// 3. Discover a live site's manifest (via /ai2w with the /.well-known/ai2w fallback)
const { manifest: live } = await discover("https://ai2web.dev");

// 4. Get an embeddable badge (a self-contained SVG string)
const svg = renderBadgeSvg(result);
```

Part of [AI2Web](https://github.com/ai2web-foundation): describe your website once, and every AI understands it.
