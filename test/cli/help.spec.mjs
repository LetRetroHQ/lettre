/*
 * Tests for lettre CLI main help output and unknown command handling.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const INSTANCE_BIN = join(ROOT, "bin", "lettre.mjs");
const CLIENT_BIN = join(ROOT, "packages", "lettre-cli", "bin", "lettre.mjs");

function run(bin, args) {
  return spawnSync(process.execPath, [bin, ...args], { encoding: "utf8" });
}

describe("main help output", () => {
  it("organizes instance CLI help into clear sections with descriptions and examples", () => {
    for (const flag of ["--help", "-h", "help"]) {
      const { status, stdout, stderr } = run(INSTANCE_BIN, [flag]);
      expect(status).toBe(0);
      expect(stderr).toBe("");
      expect(stdout).toContain("Usage: lettre <command> [options]");
      expect(stdout).toContain("Instance Commands:");
      expect(stdout).toContain("Client & API Commands:");
      expect(stdout).toContain("General Options:");
      expect(stdout).toContain("Examples:");

      // Commands present
      expect(stdout).toContain("init [dir]");
      expect(stdout).toContain("dev [wrangler dev args]");
      expect(stdout).toContain("seed [--size <n>]");
      expect(stdout).toContain("reset [port|url]");
      expect(stdout).toContain("sync-migrations");
      expect(stdout).toContain("check-context [--update]");
      expect(stdout).toContain("login <url>");
      expect(stdout).toContain("logout [url]");
      expect(stdout).toContain("api <method> <path>");

      // Examples present
      expect(stdout).toContain("lettre init my-newsletter");
      expect(stdout).toContain("lettre dev");
      expect(stdout).toContain("lettre seed --size 1k");
      expect(stdout).toContain("lettre api GET /api/posts");
    }
  });

  it("organizes client CLI help into clear sections with descriptions and examples", () => {
    for (const flag of ["--help", "-h", "help"]) {
      const { status, stdout, stderr } = run(CLIENT_BIN, [flag]);
      expect(status).toBe(0);
      expect(stderr).toBe("");
      expect(stdout).toContain("Usage: lettre <command> [options]");
      expect(stdout).toContain("Client & API Commands:");
      expect(stdout).toContain("Instance Commands:");
      expect(stdout).toContain("General Options:");
      expect(stdout).toContain("Examples:");

      // Examples present
      expect(stdout).toContain("lettre init my-newsletter");
      expect(stdout).toContain("lettre login https://news.example.com");
      expect(stdout).toContain("lettre api GET /api/posts");
      expect(stdout).toContain("lettre api --list");
    }
  });
});

describe("unknown-command error messages and suggestions", () => {
  it("suggests close command matches on instance CLI typos", () => {
    const checks = [
      ["deev", "dev"],
      ["dew", "dev"],
      ["loggin", "login"],
      ["logut", "logout"],
      ["synk-migrations", "sync-migrations"],
      ["sync", "sync-migrations"],
      ["apis", "api"],
      ["sed", "seed"],
    ];

    for (const [typo, expected] of checks) {
      const { status, stderr, stdout } = run(INSTANCE_BIN, [typo]);
      expect(status).toBe(1);
      expect(stdout).toBe("");
      expect(stderr).toBe(
        `lettre: unknown command "${typo}". Did you mean "${expected}"?\nRun 'lettre --help' to see available commands.\n`,
      );
    }
  });

  it("suggests close command matches on client CLI typos", () => {
    const checks = [
      ["deev", "dev"],
      ["loggin", "login"],
      ["sync", "sync-migrations"],
      ["apis", "api"],
    ];

    for (const [typo, expected] of checks) {
      const { status, stderr, stdout } = run(CLIENT_BIN, [typo]);
      expect(status).toBe(1);
      expect(stdout).toBe("");
      expect(stderr).toBe(
        `lettre: unknown command "${typo}". Did you mean "${expected}"?\nRun 'lettre --help' to see available commands.\n`,
      );
    }
  });

  it("reports unknown command without suggestion when no close match exists", () => {
    for (const bin of [INSTANCE_BIN, CLIENT_BIN]) {
      const { status, stderr, stdout } = run(bin, ["foobarxyz"]);
      expect(status).toBe(1);
      expect(stdout).toBe("");
      expect(stderr).toBe(
        "lettre: unknown command \"foobarxyz\".\nRun 'lettre --help' to see available commands.\n",
      );
      expect(stderr).not.toContain("Did you mean");
    }
  });
});
