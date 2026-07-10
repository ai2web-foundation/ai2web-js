// <Ai2wBadge> - an embeddable "AI Readiness" badge for React apps. Renders the shared,
// framework-free SVG from @ai2web/core (so it looks identical to the vanilla and
// server-rendered badges). Pass a `result` to render immediately, or a `url` to discover
// and score the site client-side. Uses createElement (no JSX) so it builds with the
// standard tsconfig, no jsx configuration required.

import { createElement, useMemo, type ReactElement } from "react";
import { renderBadgeSvg, type ValidationResult } from "@ai2web/core";
import { useValidate } from "./hooks.js";

export interface Ai2wBadgeProps {
  /** Site URL to discover + score. Ignored if `result` is provided. */
  url?: string;
  /** A precomputed validation result (skips the network call). */
  result?: ValidationResult;
  /** Left-hand label; defaults to "AI Readiness". */
  label?: string;
  className?: string;
}

export function Ai2wBadge(props: Ai2wBadgeProps): ReactElement {
  const validated = useValidate(props.result ? undefined : props.url);
  const result = props.result ?? validated.data;
  const svg = useMemo(
    () => (result ? renderBadgeSvg(result, { label: props.label }) : ""),
    [result, props.label],
  );

  if (!result) {
    return createElement(
      "span",
      { className: props.className },
      validated.loading ? "Checking AI readiness..." : validated.error ? "AI Readiness: unavailable" : "AI Readiness",
    );
  }
  return createElement("span", {
    className: props.className,
    role: "img",
    "aria-label": `${props.label ?? "AI Readiness"}: ${result.score} of 100, ${result.tier}`,
    dangerouslySetInnerHTML: { __html: svg },
  });
}
