#!/usr/bin/env node
/*
 * The `lettre` command: instance management and CLI for LetRetro Newsletter Platform.
 * Covers writing a new instance, local dev with the send sweep, bringing a release's migrations
 * and Claude context in, and the demo.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
);

const HELP = `lettre ${PACKAGE.version}

Usage: lettre <command> [options]

Instance Commands:
  init [dir] [--name <name>]    create a new instance repository here (or in dir)
  dev [wrangler dev args]       run locally with the send sweep once a minute (PORT picks port)
  seed [--size <n>] [port|url]  load the demo publication into the local dev server
  reset [port|url]              return the local dev server to a fresh install
  sync-migrations               copy this release's migrations into migrations/
  check-context [--update]      compare Claude files in .claude/ with this release's
  check-context --merged <file> record that you merged this release's changes into one

Client & API Commands:
  login <url> [--no-browser]    sign in to a deployed instance as you, in your browser
  logout [url]                  sign out of it on this computer
  api <method> <path> [opts]    call the API as you (run 'lettre api' for options)
  api --list | help <m> <path>  list the instance's routes, or describe one

General Options:
  help, --help                  show this
  version, --version            print the installed version

Examples:
  lettre init my-newsletter
  lettre dev
  lettre seed --size 1k
  lettre api GET /api/posts`;

const COMMANDS = [
  "init",
  "dev",
  "sync-migrations",
  "check-context",
  "seed",
  "reset",
  "login",
  "logout",
  "api",
  "version",
  "help",
];

function distance(a, b) {
  if (a === b) {
    return 0;
  }
  if (!a.length) {
    return b.length;
  }
  if (!b.length) {
    return a.length;
  }
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = a[i - 1] === b[j - 1] ? prev : Math.min(prev, row[j], row[j - 1]) + 1;
      prev = row[j];
      row[j] = next;
    }
  }
  return row[b.length];
}

function suggestCommand(cmd, valid) {
  const target = cmd.toLowerCase();
  for (const candidate of valid) {
    if (target.length >= 3 && candidate.startsWith(target)) {
      return candidate;
    }
  }
  let best = null;
  let min = 3;
  for (const candidate of valid) {
    const d = distance(target, candidate);
    if (d < min) {
      min = d;
      best = candidate;
    }
  }
  return best;
}

const [command, ...argv] = process.argv.slice(2);

switch (command) {
  case "init":
    (await import("../cli/init.mjs")).initCommand(argv);
    break;
  case "check-context":
    (await import("../cli/context.mjs")).checkContextCommand(argv);
    break;
  case "dev":
    await (await import("../cli/dev.mjs")).devCommand(argv);
    break;
  case "sync-migrations":
    (await import("../cli/sync-migrations.mjs")).syncMigrationsCommand();
    break;
  case "seed":
    await (await import("../cli/seed.mjs")).seedCommand(argv);
    break;
  case "reset":
    await (await import("../cli/reset.mjs")).resetCommand(argv);
    break;
  case "login":
    await (await import("../packages/lettre-cli/lib/login.mjs")).loginCommand(argv);
    break;
  case "logout":
    await (await import("../packages/lettre-cli/lib/login.mjs")).logoutCommand(argv);
    break;
  case "api":
    await (await import("../packages/lettre-cli/lib/api.mjs")).apiCommand(argv);
    break;
  case "version":
  case "--version":
  case "-v":
    console.log(PACKAGE.version);
    break;
  case undefined:
  case "help":
  case "--help":
  case "-h":
    console.log(HELP);
    break;
  default: {
    const suggestion = suggestCommand(command, COMMANDS);
    const hint = suggestion ? ` Did you mean "${suggestion}"?` : "";
    console.error(
      `lettre: unknown command "${command}".${hint}\nRun 'lettre --help' to see available commands.`,
    );
    process.exit(1);
  }
}
