// SSRF guard. AI2Web clients fetch URLs that come from agents and from remote
// manifests; this blocks the obvious pivots (loopback, private ranges, cloud
// metadata, link-local, non-http schemes). Note: this is a literal-host/IP check
// and is not by itself DNS-rebind safe - deployments that resolve DNS should
// additionally re-check the resolved IP.

export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost")) return false;
  // IPv6 loopback / unique-local / link-local (only when the host is actually an IPv6
  // literal, guard on ":" so real domains like "fcbarcelona.com" are not blocked).
  if (host.includes(":") && (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80"))) return false;

  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a === 0 || a === 10 || a === 127) return false; // this-network, private, loopback
    if (a === 169 && b === 254) return false; // link-local + cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 192 && b === 168) return false; // private
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  }
  return true;
}

/** Throws if the URL is not a safe public http(s) target. Returns the URL otherwise. */
export function assertSafePublicUrl(raw: string): string {
  if (!isSafePublicUrl(raw)) {
    throw new Error(`ai2w: refusing to fetch non-public or unsafe URL: ${raw}`);
  }
  return raw;
}

/** True if two URLs share the same origin (scheme + host + port). */
export function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}
