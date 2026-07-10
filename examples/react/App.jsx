// React example (plain JSX, no TypeScript required). Install: npm i @ai2web/react react
import { Ai2wBadge, useValidate, useDiscover } from "@ai2web/react";

export default function App() {
  // Discover a site and score it client-side.
  const { data: manifest, loading } = useDiscover("https://ai2web.dev");
  const { data: result } = useValidate("https://ai2web.dev");

  return (
    <main>
      <h1>AI2Web in React</h1>

      {/* Drop-in badge: pass a url (it discovers + scores) or a precomputed result. */}
      <Ai2wBadge url="https://ai2web.dev" />

      {loading && <p>Discovering...</p>}
      {manifest && (
        <p>
          {manifest.site.name}: {result ? `${result.score}/100 (${result.tier})` : "scoring..."}
        </p>
      )}
    </main>
  );
}
