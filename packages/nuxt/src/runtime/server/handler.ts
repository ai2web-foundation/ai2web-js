// Nitro server handler the module registers for every AI2Web route. `#ai2web/config` is a Nitro
// alias the module points at the project's config module, and `toWebRequest` gives us the Web
// Request that the shared AI2Web fetch handler consumes; returning a Response lets Nitro send it.
import { defineEventHandler, toWebRequest } from "h3";
import { fetchHandler } from "@ai2web/server";
import options from "#ai2web/config";

const handle = fetchHandler(options);

export default defineEventHandler((event) => handle(toWebRequest(event)));
