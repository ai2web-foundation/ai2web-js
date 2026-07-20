# @ai2web/ap2-adapter

Drive an [AI2Web](https://ai2web.dev) site's advertised **AP2** ([Agent Payments Protocol](https://ap2-protocol.org/), Google) merchant transport. AP2 is mandate-based: the merchant signs a **Cart Mandate** guaranteeing the price for a buyer agent's **Intent Mandate**, then settles a user-signed **Payment Mandate**. This adapter presents the merchant vocabulary (fetch the agent card, fetch the JWKS, create a cart, settle payment) and routes it through the shared guarded executor in `@ai2web/core`, so the payment step (`settle_payment`) is high-risk and **always previews for approval before any charge** (RFC-0006 section 3).

AI2Web does not define payment; it advertises which payment transport a site supports and lets the agent use it.

## Install

```bash
npm install @ai2web/ap2-adapter @ai2web/core
```

## Use

```js
import { manifestToAp2, buildIntentMandate, runAp2Operation } from "@ai2web/ap2-adapter";
import { discover } from "@ai2web/core";

const { manifest } = await discover("https://some-ai2web-store.com");

// Present the AP2 operations (only if the site advertises transports.ap2)
const adapter = manifestToAp2(manifest);

// Ask the merchant to price and sign a cart for an intent
const intent = buildIntentMandate({ description: "a red basketball shoe", skus: ["SHOE-RED-42"] });
const cartMandate = await runAp2Operation(manifest, "create_cart", intent);

// After the buyer's credentials provider produces a Payment Mandate, settle it.
// settle_payment is approval-gated: it returns a preview until the user approves.
const receipt = await runAp2Operation(manifest, "settle_payment", { payment_mandate: paymentMandate });
```

Verify the Cart Mandate's `merchant_authorization` JWT against the merchant's published keys with
`runAp2Operation(manifest, "get_jwks", {})`.

Part of [AI2Web](https://github.com/ai2web-foundation).
