# @ai2web/graphql-adapter

Project an [AI2Web](https://ai2web.dev) site's declared capabilities as a **GraphQL schema**. `GET` actions become `Query` fields, writes become `Mutation` fields, and every resolver runs through the shared guarded executor in `@ai2web/core`, so approval gating, the same-origin credential rule, and the SSRF guard are enforced identically to the MCP and ACP adapters (RFC-0006 section 3).

Bring your own GraphQL server: hand the generated `sdl` and `resolvers` to `makeExecutableSchema` (with a JSON scalar such as `graphql-type-json`).

## Install

```bash
npm install @ai2web/graphql-adapter @ai2web/core
```

## Use

```js
import { createGraphQLAdapter, manifestToGraphQL } from "@ai2web/graphql-adapter";
import { discover } from "@ai2web/core";

const { manifest } = await discover("https://some-ai2web-site.com");

// Just the schema (SDL + executable fields)
const { sdl, fields } = manifestToGraphQL(manifest);

// Or SDL + resolvers ready for a GraphQL server
const { sdl: schema, resolvers } = createGraphQLAdapter(manifest, { authToken: "..." });
```

Part of [AI2Web](https://github.com/ai2web-foundation).
