# Branch rulesets

`protect-main.json` is a committed copy of the **Protect main** repository ruleset (Settings → Rules → Rulesets). GitHub does **not** apply this file automatically — it lives here for version history, review, and as a re-importable source of truth.

## What it enforces (on the default branch)

- No branch deletion, no force-push.
- Changes land via pull request. All three merge methods stay allowed so the exceptions need no JSON edit; the policy (squash by default) lives in `.claude/CLAUDE.md`, where the method is chosen.
- All PR review threads must be resolved before merge.
- The `ci` status check must pass: the CI workflow (`.github/workflows/ci.yml`) runs `bun run typecheck`, `bun run test`, and `bun run ci` on pushes to repository branches. Pushes to forks do not run this repository’s workflow. `integration_id` 15368 is GitHub Actions, so only the workflow can satisfy it. The branch need not be up to date with `main` first (`strict_required_status_checks_policy` is off).
- No bypass actors.

## Re-apply / update

```bash
# Create (first time):
gh api --method POST repos/LetRetroHQ/lettre/rulesets --input .github/rulesets/protect-main.json

# Update an existing ruleset (find <id> via: gh api repos/LetRetroHQ/lettre/rulesets):
gh api --method PUT repos/LetRetroHQ/lettre/rulesets/<id> --input .github/rulesets/protect-main.json
```

If you edit the ruleset in the GitHub UI, re-export it here so this file stays the source of truth (drift is not detected automatically).

## Repository settings

Set once, recorded here so they are reproducible:

- **A squash lands the pull request's title as the commit subject and its description as the body,** so the reasoning reaches `main`'s history in the one commit that represents the change.
- **Auto-merge is allowed.** It is opt-in per pull request: enabling it on one queues the merge, with the method chosen then, until the ruleset above is satisfied (the `ci` check passes and every review thread is resolved). It relaxes nothing the ruleset enforces; it only saves waiting on CI before merging.

```bash
gh api --method PATCH repos/LetRetroHQ/lettre -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY -F allow_auto_merge=true
```
