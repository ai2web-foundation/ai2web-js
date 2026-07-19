// The integration wires a Vite alias so this virtual id resolves to the user's AI2Web config
// module (the one that default-exports { manifest, actions, ... }). Declared here so the shipped
// route entrypoint type-checks; Vite provides the real module in the consuming Astro project.
declare module "virtual:ai2web/user-config" {
  import type { Ai2wServerOptions } from "@ai2web/server";
  const options: Ai2wServerOptions;
  export default options;
}
