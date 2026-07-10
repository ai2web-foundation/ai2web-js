# AI2Web examples

The `@ai2web/*` packages are authored in TypeScript but ship as standard ESM JavaScript
plus type declarations, so they work the same in **TypeScript, JavaScript, and React**.

| Example | Stack | What it shows |
|---|---|---|
| [`node/quickstart.mjs`](node/quickstart.mjs) | Plain JS (Node) | Build a manifest, score it, write an embeddable badge SVG. No TypeScript, no build. |
| [`vanilla/index.html`](vanilla/index.html) + [`ai2w-badge.js`](vanilla/ai2w-badge.js) | Vanilla JS (browser) | A framework-free `<ai2w-badge url="...">` custom element and inline discover/score, importing `@ai2web/core` from a CDN. No bundler. |
| [`react/App.jsx`](react/App.jsx) | React | `<Ai2wBadge>` plus the `useDiscover` / `useValidate` hooks from `@ai2web/react`. |

Run the Node one:

```bash
npm i @ai2web/core
node examples/node/quickstart.mjs
```

The badge SVG (`renderBadgeSvg`) is a pure, self-contained string with no external
references, so it renders identically whether you inject it in the browser, return it from
a Worker, or embed it server-side.
