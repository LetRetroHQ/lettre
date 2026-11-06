---
name: release
description: Prepare a Lettre release by checking its version, changelog, and quality gate.
---

# Prepare a release

1. Check the release scope and changelog, and keep the instance and CLI package versions aligned.
2. Run `bun run typecheck`, `bun run test`, `bun run ci`, and `bun run check:package`.
3. Prepare the version and release notes for review. Follow the maintainer's instructions for any tag or GitHub release.

The push-triggered CI workflow runs checks only. It does not publish npm packages or deploy a site. Publishing and deployment require an explicit request.
