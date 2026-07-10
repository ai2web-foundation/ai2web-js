// Framework-free <ai2w-badge> custom element. Vanilla JavaScript, no build step, no
// dependencies to install: it imports @ai2web/core straight from a CDN as an ES module.
// Usage in any HTML page:
//   <script type="module" src="./ai2w-badge.js"></script>
//   <ai2w-badge url="https://ai2web.dev"></ai2w-badge>
//
// Note: client-side discovery does a cross-origin fetch of the target's /ai2w, so the
// target must send permissive CORS on its discovery endpoint (ai2web.dev does). For
// arbitrary sites, discover + score server-side instead and pass the result in.

import { discover, validateManifest, renderBadgeSvg } from "https://esm.sh/@ai2web/core";

class Ai2wBadge extends HTMLElement {
  static get observedAttributes() {
    return ["url", "label"];
  }
  connectedCallback() {
    this.render();
  }
  attributeChangedCallback() {
    this.render();
  }
  async render() {
    const url = this.getAttribute("url");
    if (!url) return;
    this.textContent = "Checking AI readiness...";
    try {
      const { manifest } = await discover(url);
      const result = validateManifest(manifest);
      this.innerHTML = renderBadgeSvg(result, { label: this.getAttribute("label") || undefined });
    } catch {
      this.textContent = "AI Readiness: unavailable";
    }
  }
}

customElements.define("ai2w-badge", Ai2wBadge);
