# Contributing to Lettre

This repository is Lettre's source. To run your own newsletter, you don't need it: the [README](README.md) shows how to try Lettre and deploy an instance.

## Run the source

With [Node.js](https://nodejs.org/) 22 or later:

```bash
bun install
cp .dev.vars.example .dev.vars
bun run dev
```

Open the editor at http://localhost:8787/dashboard/. There's nothing to sign in with locally, and email goes to a stand-in that never reaches a real inbox. `.dev.vars.example` explains each local setting, including how the stand-in mimics SES on a send.

### Demo data

The app starts empty. To explore it with content, load **Lettre Journal**, a demo publication kept as Markdown in [`demo/`](demo/):

```bash
bun run seed                          # load the demo
bun run simulate-send --in 90s     # schedule a send and print a link to watch it go out
bun run reset                         # back to an empty instance
```

### Calling the API

The editor is one client of Lettre's HTTP API, and Claude is the other. Locally, mint a token to call it yourself:

```bash
TOKEN=$(curl -s http://localhost:8787/api/dev/token?kind=service | jq -r .token)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8787/api/posts
```

The editor's **API** tab lists every route.

## Issues and pull requests

The most useful contributions right now are issues and discussion. If something didn't work, or the docs left you guessing, open an issue with what you did, what you expected, and what happened.

Pull requests are welcome. The ones most likely to be merged come after a discussion on the issue, and:

- open by saying, in plain words, what changes for the people who run, publish, or read a Lettre newsletter, and why;
- pass `bun run test`, `bun run typecheck`, and `bun run check`;
- update the docs they affect in the same commit, as `.claude/CLAUDE.md` describes;
- close their issue (`Closes #N`) and say what differs from it, if anything.

## Going further

- **What Lettre guarantees:** [`docs/SPEC.md`](docs/SPEC.md). The rules every API route follows: [`docs/API.md`](docs/API.md). How the admin UI is built: [`docs/DESIGN.md`](docs/DESIGN.md).
- **Working on the code:** [`.claude/CLAUDE.md`](.claude/CLAUDE.md) has the commands, conventions, and module boundaries.
- **Releases:** [`CHANGELOG.md`](CHANGELOG.md).
