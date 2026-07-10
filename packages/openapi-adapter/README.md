# @ai2web/openapi-adapter

Describe an [AI2Web](https://ai2web.dev) site's declared actions as an **OpenAPI 3.1** document (RFC-0006 section 4). It is descriptive: it produces the document, and whatever tooling consumes it does the calling. `requires_auth` becomes an OpenAPI security requirement, and risk and approval are preserved as `x-ai2w-*` extensions, so a caller sees the real semantics. Only declared actions are described, nothing more.

## Install

```bash
npm install @ai2web/openapi-adapter @ai2web/core
```

## Use

```js
import { manifestToOpenApi, manifestToOpenApiJson } from "@ai2web/openapi-adapter";
import { discover } from "@ai2web/core";

const { manifest } = await discover("https://some-ai2web-site.com");

const doc = manifestToOpenApi(manifest);   // an OpenAPI 3.1 document object
const json = manifestToOpenApiJson(manifest); // the same, as a JSON string
```

Part of [AI2Web](https://github.com/ai2web-foundation).
