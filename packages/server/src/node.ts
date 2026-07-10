// Node http adapter for the AI2Web handler.
import type { IncomingMessage, ServerResponse } from "node:http";
import { createAi2wHandler, type Ai2wServerOptions } from "./handler.js";

/** Returns a Node `(req, res)` listener that serves AI2Web routes. */
export function nodeListener(opts: Ai2wServerOptions) {
  const handle = createAi2wHandler(opts);
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const MAX_BODY = 256 * 1024; // 256 KB cap (DoS guard)
    let body: unknown = undefined;
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const c of req) {
        size += (c as Buffer).length;
        if (size > MAX_BODY) {
          res.writeHead(413, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: { code: "payload_too_large", retryable: false } }));
          return;
        }
        chunks.push(c as Buffer);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      body = raw ? safeJson(raw) : undefined;
    }
    const origin = `${url.protocol}//${url.host}`;
    const out = await handle({ method: req.method ?? "GET", path: url.pathname, body, origin });
    res.writeHead(out.status, out.headers);
    res.end(out.body === null ? "" : JSON.stringify(out.body));
  };
}

function safeJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return raw; }
}
