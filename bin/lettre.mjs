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

  init [dir] [--name <name>]    write a new instance repository here (or in dir)
  dev [wrangler dev args]       run locally, with the send sweep once a minute (PORT picks the port)
  sync-migrations               copy this release's migrations into migrations/
  check-context [--update]      compare the Claude files in .claude/ with this release's
  check-context --merged <file> record that you merged this release's changes into one
  seed [--size <n>] [port|url]  load the demo publication into the local dev server
  reset [port|url]              return the local dev server to a fresh install

  login <url> [--no-browser]    sign in to a deployed instance as you, in your browser
  logout [url]                  sign out of it on this computer
  api <method> <path> [opts]    call the API as you, via Claude Code (lettre api for options)
  api --list | help <m> <path>  list the instance's routes, or describe one

  help, --help                  show this
  version, --version            print the installed version`;

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
  default:
    console.error(`lettre: unknown command "${command}"\n\n${HELP}`);
    process.exit(1);
}
