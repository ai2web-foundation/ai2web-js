// SSRF guard. AI2Web clients fetch URLs that come from agents and from remote
// manifests; this blocks the obvious pivots (loopback, private ranges, cloud
// metadata, link-local, non-http schemes). Note: this is a literal-host/IP check
// and is not by itself DNS-rebind safe - deployments that resolve DNS should
// additionally re-check the resolved IP.

// Extract the embedded IPv4 from an IPv4-mapped/compat IPv6 host, in either the dotted form
// (::ffff:a.b.c.d) or the hex-compressed form a WHATWG URL parser produces (::ffff:7f00:1).
function mappedIpv4(host: string): string | null {
  let m = host.match(/^::(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (m) return m[1];
  m = host.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (m) {
    const hi = parseInt(m[1], 16), lo = parseInt(m[2], 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  return null;
}

function ipv4Blocked(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return true; // not a real address; refuse
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost")) return false;

  // IPv6 literal. Extract an embedded IPv4 (::ffff:a.b.c.d / ::a.b.c.d) and range-check it, then
  // block loopback / unique-local / link-local. Guard on ":" so real domains are not affected.
  if (host.includes(":")) {
    const mapped = mappedIpv4(host);
    if (mapped && ipv4Blocked(mapped)) return false;
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return false;
    return true;
  }

  // Hex-encoded IP (0x7f000001 or a dotted 0x octet) that a client resolves to an address.
  if (/(^|\.)0x/.test(host)) return false;

  // Standard dotted-quad IPv4.
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return !ipv4Blocked(host);

  // Any remaining all-numeric host is an alternative IPv4 encoding (decimal integer, octal, or a
  // short form like 127.1) that a client resolves to an IP. No legitimate domain looks like this.
  if (!/[a-z]/.test(host)) return false;

  return true;
}

/** Throws if the URL is not a safe public http(s) target. Returns the URL otherwise. */
export function assertSafePublicUrl(raw: string): string {
  if (!isSafePublicUrl(raw)) {
    throw new Error(`ai2w: refusing to fetch non-public or unsafe URL: ${raw}`);
  }
  return raw;
}

export interface SafeFetchOptions {
  fetchImpl?: typeof fetch;
  maxRedirects?: number;
}

/**
 * fetch() that re-validates every hop. Redirects are followed manually and each target must pass
 * isSafePublicUrl, so a public URL cannot 3xx-pivot the request onto a loopback / private / cloud
 * metadata host. Credential headers (Authorization / Cookie) are dropped the moment a redirect
 * crosses origin, mirroring the browser fetch spec, so a manifest cannot 3xx-siphon a bearer token
 * to an attacker-controlled origin. Use this for any request whose URL comes from an agent or a
 * remote manifest.
 */
export async function safeFetch(url: string, init: RequestInit = {}, opts: SafeFetchOptions = {}): Promise<Response> {
  const doFetch = opts.fetchImpl ?? fetch;
  const maxRedirects = opts.maxRedirects ?? 5;
  let current = url;
  let headers = new Headers(init.headers);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    assertSafePublicUrl(current);
    const res = await doFetch(current, { ...init, headers, redirect: "manual" });
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) return res;
    const next = new URL(location, current).toString(); // resolve relative redirects against the current hop
    if (new URL(next).origin !== new URL(current).origin) {
      headers = new Headers(headers);
      headers.delete("authorization");
      headers.delete("cookie");
    }
    current = next;
  }
  throw new Error(`ai2w: too many redirects while fetching ${url}`);
}

/** True if two URLs share the same origin (scheme + host + port). */
export function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}
