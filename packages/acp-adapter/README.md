# @ai2web/acp-adapter

Drive an [AI2Web](https://ai2web.dev) site's advertised **ACP** (Agentic Commerce Protocol) checkout transport, RFC-0005 Profile 1. It presents the checkout-session vocabulary (create, get, update, complete, cancel) and routes it through the shared guarded executor in `@ai2web/core`, so the payment step (`complete_checkout_session`) is high-risk and **always previews for approval before any charge** (RFC-0006 section 3).

AI2Web does not define checkout; it advertises which checkout transport a site supports and lets the agent use it.

## Install

```bash
npm install @ai2web/acp-adapter @ai2web/core
```

## Use

```js
import { manifestToAcp, runAcpOperation } from "@ai2web/acp-adapter";
import { discover } from "@ai2web/core";

const { manifest } = await discover("https://some-ai2web-store.com");

// Present the checkout operations (only if the site advertises transports.acp)
const adapter = manifestToAcp(manifest);

// Run one under the full contract; the payment step returns a preview until approved
const session = await runAcpOperation(manifest, "create_checkout_session", { items: [] });
const receipt = await runAcpOperation(manifest, "complete_checkout_session", { session_id: session.id });
```

Part of [AI2Web](https://github.com/ai2web-foundation).
