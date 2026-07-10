// React hooks over @ai2web/core. Thin wrappers around the framework-agnostic client
// (discover / validateManifest / negotiate) so React apps can discover a site, score its
// AI readiness, or negotiate transports without touching the protocol plumbing.

import { useState, useEffect } from "react";
import {
  discover,
  validateManifest,
  negotiate,
  type Manifest,
  type ValidationResult,
  type AgentSupports,
  type NegotiationResult,
} from "@ai2web/core";

export interface AsyncState<T> {
  data?: T;
  loading: boolean;
  error?: Error;
}

/** Discover a site's AI2Web manifest (via /ai2w with the /.well-known/ai2w fallback). */
export function useDiscover(target?: string): AsyncState<Manifest> {
  const [state, setState] = useState<AsyncState<Manifest>>({ loading: Boolean(target) });
  useEffect(() => {
    if (!target) {
      setState({ loading: false });
      return;
    }
    let live = true;
    setState({ loading: true });
    discover(target)
      .then((r) => live && setState({ data: r.manifest, loading: false }))
      .catch((e) => live && setState({ loading: false, error: e instanceof Error ? e : new Error(String(e)) }));
    return () => {
      live = false;
    };
  }, [target]);
  return state;
}

/**
 * Validate a site's AI readiness. Pass a manifest object to score it directly, or a URL
 * to discover then score. Returns { data: { score, tier, checks, ... }, loading, error }.
 */
export function useValidate(input?: string | Manifest): AsyncState<ValidationResult> {
  const [state, setState] = useState<AsyncState<ValidationResult>>({ loading: Boolean(input) });
  const key = typeof input === "string" ? input : input ? JSON.stringify(input) : "";
  useEffect(() => {
    if (!input) {
      setState({ loading: false });
      return;
    }
    if (typeof input !== "string") {
      setState({ data: validateManifest(input), loading: false });
      return;
    }
    let live = true;
    setState({ loading: true });
    discover(input)
      .then((r) => live && setState({ data: validateManifest(r.manifest), loading: false }))
      .catch((e) => live && setState({ loading: false, error: e instanceof Error ? e : new Error(String(e)) }));
    return () => {
      live = false;
    };
    // key captures both the URL string and a manifest's contents.
  }, [key]);
  return state;
}

/** Negotiate the transports/capabilities shared by a site manifest and an agent. */
export function useNegotiate(manifest?: Manifest, agent: AgentSupports = {}): NegotiationResult | undefined {
  const [result, setResult] = useState<NegotiationResult | undefined>(undefined);
  const agentKey = JSON.stringify(agent);
  useEffect(() => {
    setResult(manifest ? negotiate(manifest, agent) : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, agentKey]);
  return result;
}
