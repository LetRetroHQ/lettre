# Newsletter

This repository is a [Lettre](https://github.com/LetRetroHQ/lettre) instance: a newsletter platform running on your Cloudflare account. It holds the instance's configuration (`wrangler.jsonc`), its database migrations (`migrations/`), and the Lettre release it runs, pinned in `package.json`. Lettre itself comes from the `@letretro/lettre` package.

The setup guide for the installed release is in `node_modules/@letretro/lettre/docs/` after `bun install`, and in the editor's **Docs** tab.

## Local setup

```bash
bun install
cp .dev.vars.example .dev.vars
bun run dev
```

Open the editor at http://localhost:8787/dashboard/. Email goes to a stand-in that never reaches a real inbox. `bun run seed` loads a demo publication, and `bun run reset` empties it again.

## Commands

| Command | What it does |
| :- | :- |
| `bun run dev` | Runs the app locally, with the send sweep once a minute |
| `bun run seed`, `bun run reset` | Loads the demo publication into the local app, or empties it |
| `bun run sync-migrations` | Copies the installed release's migrations into `migrations/` |
| `bun run check-context` | Compares the Claude files in `.claude/` with the installed release's |
| `bunx lettre login <url>` | Signs Claude Code in to the deployed instance as you, in your browser |
| `bunx lettre api <method> <path>` | Calls the API as you, via Claude Code (`--local` for the local app); `--list` lists the routes and `help <method> <path>` describes one |
| `bunx wrangler deploy --env production` | Deploys the instance |
| `bunx wrangler d1 migrations apply DB --remote --env production` | Applies new migrations to the production database |

Your own migrations go in `migrations/` with a `local_` name, such as `local_0001_add_index.sql`, so they never collide with Lettre's.
