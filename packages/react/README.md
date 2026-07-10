# @ai2web/react

React bindings for [AI2Web](https://ai2web.dev): hooks over the framework-agnostic core client, plus an embeddable **AI Readiness badge**. React is an optional peer dependency.

## Install

```bash
npm install @ai2web/react @ai2web/core react
```

## Use

```jsx
import { Ai2wBadge, useDiscover, useValidate } from "@ai2web/react";

function SiteCard() {
  const { data: manifest, loading } = useDiscover("https://ai2web.dev");
  const { data: result } = useValidate("https://ai2web.dev");

  return (
    <div>
      {/* Drop-in badge: pass a url (it discovers + scores) or a precomputed result */}
      <Ai2wBadge url="https://ai2web.dev" />
      {loading ? "Discovering..." : manifest?.site.name}
      {result && ` - ${result.score}/100 (${result.tier})`}
    </div>
  );
}
```

Hooks: `useDiscover`, `useValidate`, `useNegotiate`. For a build-free option, a framework-free `<ai2w-badge>` web component ships in the examples. Part of [AI2Web](https://github.com/ai2web-foundation).
