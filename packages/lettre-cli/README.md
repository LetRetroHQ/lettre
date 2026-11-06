# Lettre CLI

The command-line client for [Lettre by LetRetro](https://github.com/LetRetroHQ/lettre), a self-hosted newsletter platform. Node.js 22 or later is required.

```bash
bunx --package @letretro/lettre-cli lettre login https://newsletter.example.com
bunx --package @letretro/lettre-cli lettre api GET /api/posts
bunx --package @letretro/lettre-cli lettre api --list
```

Run `bunx --package @letretro/lettre-cli lettre init` in an empty directory to create an instance. Within an instance, `lettre` runs its installed version. See the [setup guide](https://github.com/LetRetroHQ/lettre/blob/main/docs/README.md) for deployment and publishing instructions.
