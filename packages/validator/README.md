# @ai2web/validator

The command-line **AI Readiness Validator** for [AI2Web](https://ai2web.dev). Scores any live site or manifest file out of 100 and reports its compliance tier, using the same algorithm as `@ai2web/core`.

## Use

```bash
# no install needed
npx -p @ai2web/validator ai2web validate https://ai2web.dev
npx -p @ai2web/validator ai2web validate ./manifest.json

# or install globally and run `ai2web`
npm install -g @ai2web/validator
ai2web validate https://ai2web.dev
```

Output is a per-capability report plus a score line, for example:

```
  AI Readiness Score  96/100   Tier: Standard
```

A live, in-browser version is at [ai2web.dev](https://ai2web.dev/#validator). Part of [AI2Web](https://github.com/ai2web-foundation).
