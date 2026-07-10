// Fluent manifest builder - the "describe your website once" developer surface.

import type { Manifest, Site, Capabilities, Action, Events, Auth, Consent, Transports, AgentService } from "./types.js";

export class Ai2wBuilder {
  private m: Manifest;

  constructor(site: Site) {
    this.m = { protocol: "ai2w", version: "0.1", site, capabilities: {} };
  }

  capability(name: keyof Capabilities | string, value: boolean | Record<string, unknown> = true): this {
    this.m.capabilities[name] = value === true ? true : value === false ? false : { enabled: true, ...value };
    return this;
  }

  transports(t: Transports): this { this.m.transports = { ...this.m.transports, ...t }; return this; }
  auth(a: Auth): this { this.m.auth = a; return this; }
  consent(c: Consent): this { this.m.consent = c; return this; }
  action(a: Action): this { (this.m.actions ??= []).push(a); this.capability("actions", { endpoint: "/ai2w/actions" }); return this; }
  events(e: Events): this { this.m.events = e; this.capability("events", { endpoint: e.endpoint ?? "/ai2w/events" }); return this; }
  agentService(s: AgentService): this { this.m.agent_service = s; return this; }
  identity(i: Manifest["identity"]): this { this.m.identity = i; return this; }
  contact(c: Manifest["contact"]): this { this.m.contact = c; return this; }
  extend(key: `x-${string}`, value: unknown): this { this.m[key] = value; return this; }

  build(): Manifest { return this.m; }
  toJSON(): string { return JSON.stringify(this.m, null, 2); }
}

/** Convenience: `ai2web({ name, url, type })` → builder. */
export function ai2web(site: Site): Ai2wBuilder {
  return new Ai2wBuilder(site);
}
