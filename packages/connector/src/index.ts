// @ai2web/connector - public API.
export {
  httpDirectory,
  findSites,
  describeSite,
  planForAgent,
  type DirectoryClient,
  type SiteRef,
  type SiteQuery,
  type SitePlan,
} from "./connector.js";
export { createConnectorServer, type ConnectorOptions } from "./server.js";
