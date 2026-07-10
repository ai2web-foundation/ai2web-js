// @ai2web/openapi-adapter - describe an AI2Web site's declared actions as an OpenAPI 3.1
// document (RFC-0006 §4). Descriptive only: it produces the document; execution is done
// by whatever tooling consumes it. requires_auth becomes an OpenAPI security requirement;
// risk / approval are preserved as x-ai2w-* extensions so callers see the real semantics.
export { manifestToOpenApi, manifestToOpenApiJson, type OpenApiOptions } from "./openapi.js";
