#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { discover, validateManifest, assertSafePublicUrl, type Manifest, type ValidationResult } from "@ai2web/core";

const C = { reset: "\x1b[0m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", dim: "\x1b[2m", bold: "\x1b[1m" };

async function load(target: string): Promise<{ manifest: Manifest; source: string }> {
  if (!/^https?:\/\//i.test(target)) {
    return { manifest: JSON.parse(readFileSync(target, "utf8")) as Manifest, source: target };
  }
  return discover(target);
}

function render(source: string, r: ValidationResult): number {
  process.stdout.write(`\n${C.bold}AI2Web Validator${C.reset} ${C.dim}${source}${C.reset}\n\n`);
  if (r.errors.length) {
    process.stdout.write(`${C.red}Errors:${C.reset}\n`);
    for (const e of r.errors) process.stdout.write(`  ${C.red}✗${C.reset} ${e}\n`);
    process.stdout.write("\n");
  }
  for (const c of r.checks) {
    if (c.label === "Valid discovery manifest") continue;
    if (c.ok) process.stdout.write(`  ${C.green}✓${C.reset} ${c.label}\n`);
    else process.stdout.write(`  ${C.yellow}⚠${C.reset} ${c.label} ${C.dim}- ${c.hint}${C.reset}\n`);
  }
  const band = r.score >= 80 ? C.green : r.score >= 50 ? C.yellow : C.red;
  process.stdout.write(`\n  ${C.bold}AI Readiness Score${C.reset}  ${band}${r.score}/100${C.reset}   ${C.dim}Tier:${C.reset} ${r.tier}\n\n`);
  return r.tier === "Invalid" ? 1 : 0;
}

function resolveUrl(origin: string, endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `${origin.replace(/\/+$/, "")}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
}

/** Reachability probe: safe GET with a timeout, never calls actions (they may change state). */
async function probe(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: string }> {
  try {
    assertSafePublicUrl(url);
  } catch {
    return { ok: false, status: "unsafe-url" };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: ctrl.signal });
    return { ok: res.status >= 200 && res.status < 400, status: String(res.status) };
  } catch (err) {
    return { ok: false, status: (err as Error).name === "AbortError" ? "timeout" : "unreachable" };
  } finally {
    clearTimeout(t);
  }
}

/** `ai2web check <url>` - discover the manifest, then probe the declared read endpoints. */
async function check(url: string): Promise<number> {
  const { manifest, source } = await discover(url);
  const origin = new URL(manifest.site?.url ?? url).origin;
  process.stdout.write(`\n${C.bold}AI2Web Check${C.reset} ${C.dim}${origin}${C.reset}\n\n`);

  const targets: { label: string; url: string }[] = [
    { label: "discovery anchor  /.well-known/ai2w", url: `${origin}/.well-known/ai2w` },
    { label: "manifest          /ai2w", url: /^https?:\/\//i.test(source) ? source : `${origin}/ai2w` },
  ];
  for (const [name, cap] of Object.entries(manifest.capabilities ?? {})) {
    const endpoint = cap && typeof cap === "object" ? (cap as { endpoint?: string }).endpoint : undefined;
    if (typeof endpoint === "string") targets.push({ label: `module: ${name} ${endpoint}`, url: resolveUrl(origin, endpoint) });
  }

  let failures = 0;
  for (const tg of targets) {
    const r = await probe(tg.url);
    if (!r.ok) failures++;
    process.stdout.write(`  ${r.ok ? C.green + "✓" : C.red + "✗"}${C.reset} ${tg.label} ${C.dim}${r.status}${C.reset}\n`);
  }

  const acts = manifest.actions ?? [];
  if (acts.length) {
    process.stdout.write(`\n  ${C.dim}Declared actions (not called - they may change state):${C.reset}\n`);
    for (const a of acts) process.stdout.write(`    ${C.dim}${a.method} ${a.endpoint}  [${a.risk}]${C.reset}\n`);
  }

  process.stdout.write(`\n  ${failures === 0 ? C.green + "All declared read endpoints reachable" : C.red + failures + " endpoint(s) unreachable"}${C.reset}\n\n`);
  return failures === 0 ? 0 : 1;
}

async function main() {
  const [cmd, target] = process.argv.slice(2);
  try {
    if (cmd === "validate" && target) {
      const { manifest, source } = await load(target);
      process.exit(render(source, validateManifest(manifest)));
    }
    if (cmd === "check" && target) {
      if (!/^https?:\/\//i.test(target)) {
        process.stderr.write("check requires a live URL (it probes the declared endpoints).\n");
        process.exit(2);
      }
      process.exit(await check(target));
    }
    process.stderr.write("Usage:\n  ai2web validate <url-or-file>   score a manifest against the spec\n  ai2web check <url>              probe the declared endpoints of a live site\n");
    process.exit(2);
  } catch (err) {
    process.stderr.write(`${C.red}error:${C.reset} ${(err as Error).message}\n`);
    process.exit(2);
  }
}

main();
