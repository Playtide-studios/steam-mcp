# Contributing

Thanks for helping make Steam data easier for agents to use.

## Ground rules

- TypeScript with node-native type stripping — no build step, `node src/index.ts` runs
  the source directly. Keep it that way: zero runtime dependencies is a feature.
- Conventional commit subjects (`feat:`, `fix:`, `docs:`, `chore:`).
- Every PR: `npm run typecheck` and `npm test` green on CI.
- Fetched internet text (reviews, news) must stay data — never parsed as instructions
  for the model.

## Adding a tool

1. Add the handler in `src/tools.ts` (fetch from Steam or the backend, shape the text).
2. Describe it in `src/fallback-manifest.json` — description + guidance; the manifest
   is what consuming models read.
3. A tool that needs the backend: add the backend route first and note the version.

## Reporting bugs

Use the issue template; include the failing tool call JSON.