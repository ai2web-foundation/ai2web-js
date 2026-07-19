// Minimal ambient declarations for the slice of @nuxt/kit + h3 this module uses, so @ai2web/nuxt
// needs no build-time dependency on Nuxt (it stays a peer dependency). The consuming Nuxt project
// provides the real implementations at build/runtime.

declare module "@nuxt/kit" {
  export function defineNuxtModule<T = Record<string, unknown>>(definition: {
    meta?: { name?: string; configKey?: string; compatibility?: Record<string, string> };
    defaults?: Partial<T> | ((nuxt: unknown) => Partial<T>);
    setup?: (options: T, nuxt: NuxtLike) => void | Promise<void>;
  }): unknown;

  export function createResolver(base: string | URL): { resolve: (...path: string[]) => string };

  export function addServerHandler(handler: {
    route?: string;
    handler: string;
    method?: string;
    middleware?: boolean;
  }): void;

  export interface NuxtLike {
    options: {
      srcDir: string;
      nitro?: { alias?: Record<string, string> } & Record<string, unknown>;
    } & Record<string, unknown>;
  }
}

declare module "h3" {
  export type EventHandler = (event: unknown) => unknown;
  export function defineEventHandler(handler: (event: unknown) => unknown): EventHandler;
  export function toWebRequest(event: unknown): Request;
}

// The module wires this Nitro alias to the project's AI2Web config module.
declare module "#ai2web/config" {
  import type { Ai2wServerOptions } from "@ai2web/server";
  const options: Ai2wServerOptions;
  export default options;
}
