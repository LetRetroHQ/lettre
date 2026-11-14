#!/usr/bin/env node
/*
 * The `lettre` command as published under the unscoped name: Lettre's client, which runs
 * from anywhere (`npx lettre login <url>`, `npx lettre api …`). It signs a person in to a
 * deployed instance and calls its API as them, reading what the API is from the instance's own
 * OpenAPI document, so it needs none of the instance's code and works with any release.
 *
 * The commands that act on an instance's repository (init, dev, and the rest) belong to the
 * release that instance runs, so they live in `@letretro/lettre`, and this hands them to that
 * install (lib/handoff.mjs). The instance package ships this same client source, so in an
 * instance's repository, where its `lettre` is the one npx finds, nothing else is needed.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { INSTANCE_COMMANDS, INSTANCE_PACKAGE, runInstanceCommand } from "../lib/handoff.mjs";

const PACKAGE = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
);

const HELP = `lettre ${PACKAGE.version}

Usage: lettre <command> [options]

Client & API Commands:
  login <url> [--no-browser]    sign in to a deployed instance as you, in your browser
  logout [url]                  sign out of it on this computer
  api <method> <path> [opts]    call the API as you (run 'lettre api' for options)
  api --list | help <m> <path>  list the instance's routes, or describe one

Instance Commands:
  init [dir] [--name <name>]    write a new instance repository here (or in dir)
  dev, seed, reset, sync-migrations, check-context
                                run in an instance repository, by its ${INSTANCE_PACKAGE}

General Options:
  help, --help                  show this
  version, --version            print this client's version

Examples:
  lettre init my-newsletter
  lettre login https://news.example.com
  lettre api GET /api/posts
  lettre api --list`;

const COMMANDS = [...INSTANCE_COMMANDS, "login", "logout", "api", "version", "help"];

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

if (INSTANCE_COMMANDS.includes(command)) {
  runInstanceCommand(command, argv, PACKAGE.version);
} else {
  switch (command) {
    case "login":
      await (await import("../lib/login.mjs")).loginCommand(argv);
      break;
    case "logout":
      await (await import("../lib/login.mjs")).logoutCommand(argv);
      break;
    case "api":
      await (await import("../lib/api.mjs")).apiCommand(argv);
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
}
