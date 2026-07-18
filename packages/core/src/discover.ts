// Discovery client: fetch a site's manifest via /ai2w with /.well-known/ai2w fallback.

import type { Manifest } from "./types.js";
import { safeFetch } from "./safety.js";

export interface DiscoverResult {
  manifest: Manifest;
  source: string;
}

/** Fetch and parse a site's AI2Web manifest. Accepts a site origin or a direct manifest URL. */
export async function discover(target: string): Promise<DiscoverResult> {
  const base = target.replace(/\/+$/, "");
  const candidates = /\/ai2w(\/|$)|\/\.well-known\/ai2w$/.test(base)
    ? [base]
    : [`${base}/ai2w`, `${base}/.well-known/ai2w`];

  let lastErr: unknown;
  for (const url of candidates) {
    try {
      // safeFetch re-validates every redirect hop, so a manifest cannot 3xx-pivot to an internal host.
      const res = await safeFetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) continue;
      const json = (await res.json()) as Record<string, unknown>;
      // Pointer form from the well-known anchor: { "ai2w": "https://host/ai2w" }
      if (typeof json.ai2w === "string" && json.protocol === undefined) {
        const r2 = await safeFetch(json.ai2w, { headers: { accept: "application/json" } });
        if (!r2.ok) throw new Error(`ai2w pointer target returned ${r2.status}`);
        return { manifest: (await r2.json()) as Manifest, source: json.ai2w };
      }
      return { manifest: json as unknown as Manifest, source: url };
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`No AI2Web manifest at ${base}/ai2w or ${base}/.well-known/ai2w` + (lastErr ? `: ${String(lastErr)}` : ""));
}
