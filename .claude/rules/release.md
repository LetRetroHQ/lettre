---
paths:
  - "CHANGELOG.md"
  - "package.json"
  - "packages/lettre-cli/package.json"
---

# Releases

Keep the instance and CLI package versions aligned, and document release changes in `CHANGELOG.md`. Run `bun run typecheck`, `bun run test`, `bun run ci`, and `bun run check:package` before preparing a release.

The repository currently has only a push-triggered CI workflow. Creating a tag or GitHub release does not publish packages or deploy a site. Treat publishing and deployment as separate actions and do them only when explicitly requested.
