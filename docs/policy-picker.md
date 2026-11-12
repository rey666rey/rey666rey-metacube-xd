# Local policy picker customization

Based on upstream MetaCubeXD **v1.261.3**, commit `a9369eae4093528f863451b298319d3ad0c85d5c`.

This is a dashboard-only change. Existing group membership, names, routing,
automatic selection and API selection calls are preserved. Folders are never
added to the Mihomo configuration.

## Behaviour

- Each policy has its own country/name/provider search and collapsible folders.
- Nested groups and aggregators remain individual selectable entries at the top.
- Original vendor prefixes take precedence over an aggregate subscription's name;
  BlancVPN, V220, MASTER, DOG and LETO are recognized. Provider membership is used
  when available. Untagged private/domain-based sources fall under custom nodes.
- Country aliases match English/Russian names and flags anywhere in a node name.
- Matching folders open during search; empty folders disappear. Query clearing
  restores normal folder state. Search/folder state survives collapse in memory,
  scoped to the backend and policy, and is cleared by a full page reload.
- The selected entry stays highlighted; its folder has a selected badge.
- Card, list, table, chip and master-detail layouts retain node selection and
  latency controls. Large folders render in batches of 50 with a Show more button.

## Build

Use the checked-in lockfile and install only the UI workspace dependencies.
With the repository's pnpm version available:

```sh
pnpm install --filter @metacubexd/ui... --frozen-lockfile
pnpm --filter @metacubexd/ui typecheck
pnpm --filter @metacubexd/ui exec vitest run --exclude='e2e/**'
NUXT_APP_BASE_URL=./ pnpm --filter @metacubexd/ui generate
```

The static output is `packages/ui/.output/public`. No Node.js process is needed
on the router. Do not package `node_modules`, test data, local endpoint settings
or API secrets with it.

## Deployment and recovery

Back up the current UI directory before deploying. Copy hashed `_nuxt` and font
assets first, keeping old hashed assets for tabs that are already open. Preserve
the existing deployment's `config.js`. Replace `index.html` only after all its
resources are available. Update the SPA fallback pages and service-worker files
as part of the same release. Do not restart Mihomo or change routing settings.

To roll back, restore the previous UI backup including its entry HTML. Unused
new hashed assets can remain until old tabs have closed. Existing browser or PWA
caches may require a refresh/update before showing the replacement.

An upstream dashboard update can replace this customization. Retain this branch
or patch and rebuild it when updating the upstream base; do not patch minified
bundles by hand.
