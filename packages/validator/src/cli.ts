#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { discover, validateManifest, type Manifest, type ValidationResult } from "@ai2web/core";

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

async function main() {
  const [cmd, target] = process.argv.slice(2);
  if (cmd !== "validate" || !target) {
    process.stderr.write("Usage: ai2web validate <url-or-file>\n");
    process.exit(2);
  }
  try {
    const { manifest, source } = await load(target);
    process.exit(render(source, validateManifest(manifest)));
  } catch (err) {
    process.stderr.write(`${C.red}error:${C.reset} ${(err as Error).message}\n`);
    process.exit(2);
  }
}

main();
