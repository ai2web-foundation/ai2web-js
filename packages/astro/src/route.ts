// The endpoint the integration injects for every AI2Web route. Astro resolves the
// `virtual:ai2web/user-config` import (aliased by the integration) to the project's config module,
// so all injected routes serve from the one manifest + actions.
import options from "virtual:ai2web/user-config";
import { createAi2wRoute } from "./index.js";

export const prerender = false;
export const ALL = createAi2wRoute(options);
