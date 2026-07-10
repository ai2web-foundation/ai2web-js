// Framework-free "AI Readiness" badge. Pure functions (no DOM, no React), so the same
// code renders in a browser via innerHTML, in a React component, in a Worker, or on the
// server. `badgeData` is the machine-readable summary; `renderBadgeSvg` returns a
// self-contained SVG string a site can embed to show its AI Readiness Score.

import type { ValidationResult, ComplianceTier } from "./types.js";

export interface BadgeData {
  score: number;
  tier: ComplianceTier;
  label: string;
  /** Accent colour for the tier (hex). */
  color: string;
}

const TIER_COLOR: Record<ComplianceTier, string> = {
  Enterprise: "#1f883d",
  Standard: "#3fb950",
  Basic: "#d29922",
  Invalid: "#cf222e",
};

export function badgeData(result: ValidationResult, label = "AI Readiness"): BadgeData {
  return {
    score: result.score,
    tier: result.tier,
    label,
    color: TIER_COLOR[result.tier] ?? TIER_COLOR.Invalid,
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface BadgeOptions {
  /** Left-hand label; defaults to "AI Readiness". */
  label?: string;
  /** Approx px per character used to size segments (default 6.6). */
  charWidth?: number;
}

/**
 * Render a self-contained, flat "AI Readiness" badge as an SVG string. No external
 * fetches, fonts or scripts - safe to inline anywhere or serve from a Worker.
 */
export function renderBadgeSvg(result: ValidationResult, opts: BadgeOptions = {}): string {
  const d = badgeData(result, opts.label ?? "AI Readiness");
  const cw = opts.charWidth ?? 6.6;
  const value = `${d.score} · ${d.tier}`; // "83 · Standard"
  const padL = 10;
  const leftW = Math.round(d.label.length * cw + padL * 2);
  const rightW = Math.round(value.length * cw + padL * 2);
  const w = leftW + rightW;
  const h = 20;
  const lcx = leftW / 2;
  const rcx = leftW + rightW / 2;
  const font = "font-family='Segoe UI,Helvetica,Arial,sans-serif' font-size='11'";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" role="img" ` +
    `aria-label="${esc(d.label)}: ${d.score} of 100, ${d.tier}">` +
    `<title>${esc(d.label)}: ${d.score}/100 (${d.tier})</title>` +
    `<rect width="${w}" height="${h}" rx="3" fill="#24292f"/>` +
    `<rect x="${leftW}" width="${rightW}" height="${h}" rx="3" fill="${d.color}"/>` +
    `<rect x="${leftW}" width="6" height="${h}" fill="${d.color}"/>` +
    `<g fill="#fff" text-anchor="middle" ${font}>` +
    `<text x="${lcx}" y="14">${esc(d.label)}</text>` +
    `<text x="${rcx}" y="14">${esc(value)}</text>` +
    `</g></svg>`
  );
}
