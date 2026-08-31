#!/usr/bin/env node
/**
 * Copies a hook from `.claude/hooks/` into this checkout's real hooks directory.
 *
 *   node scripts/install-git-hooks.mjs commit-msg
 *   node scripts/install-git-hooks.mjs --list
 *   node scripts/install-git-hooks.mjs --uninstall commit-msg
 *
 * Copying one named hook rather than pointing `core.hooksPath` at `.claude/hooks`:
 * that config switch would install every file in the directory at once, and
 * `.claude/hooks/pre-commit` is deliberately not installed
 * (`tasks/open/pre-commit-hook-not-installed.md`). Installing a hook the human did
 * not ask for is the failure this avoids.
 *
 * Resolves the hooks directory through `git rev-parse --git-path hooks`, so it is
 * correct inside a linked worktree, where `.git` is a file rather than a directory.
 */
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

const root = git("rev-parse", "--show-toplevel");
const hooksDir = resolve(root, git("rev-parse", "--git-path", "hooks"));
const sourceDir = join(root, ".claude", "hooks");

const argv = process.argv.slice(2);
const uninstall = argv.includes("--uninstall");
const names = argv.filter((arg) => !arg.startsWith("--"));

if (argv.includes("--list") || names.length === 0) {
  const available = readdirSync(sourceDir).filter((name) => !name.endsWith(".mjs"));
  process.stdout.write(
    `hooks directory: ${hooksDir}\n\navailable in .claude/hooks/:\n` +
      available
        .map((name) => {
          const installed = existsSync(join(hooksDir, name)) ? "installed" : "not installed";
          return `  ${name.padEnd(14)} ${installed}\n`;
        })
        .join("") +
      "\ninstall with: npm run commit:hook   (or: node scripts/install-git-hooks.mjs <name>)\n",
  );
  process.exit(0);
}

mkdirSync(hooksDir, { recursive: true });

for (const name of names) {
  const target = join(hooksDir, name);
  if (uninstall) {
    if (existsSync(target)) {
      rmSync(target);
      process.stdout.write(`removed ${target}\n`);
    } else {
      process.stdout.write(`${name} was not installed\n`);
    }
    continue;
  }

  const source = join(sourceDir, name);
  if (!existsSync(source)) {
    process.stderr.write(`no such hook: .claude/hooks/${name}\n`);
    process.exit(1);
  }
  // Normalized rather than copied verbatim. `core.autocrlf=true` checks these
  // scripts out with CRLF, and a shebang of `#!/bin/sh\r` is rejected as a bad
  // interpreter. `.gitattributes` pins them to LF as well; this line means the
  // installed hook is correct even in a checkout that ignores it.
  writeFileSync(target, readFileSync(source, "utf8").replace(/\r\n/g, "\n"), "utf8");
  chmodSync(target, 0o755);
  process.stdout.write(
    `installed ${name} -> ${target}\n` +
      "  Hooks live in the COMMON git directory, so this applies to the main\n" +
      "  checkout and every linked worktree at once — including any concurrent\n" +
      "  session. Verified: `git rev-parse --git-path hooks` from a worktree\n" +
      "  resolves to the main repository's .git/hooks.\n" +
      `  Remove it with: node scripts/install-git-hooks.mjs --uninstall ${name}\n`,
  );
}
