#!/usr/bin/env node
// Fleet CLI: apply | diff | deploy. Runs directly on Node >= 23 (native TS).
//
// A thin driver over the resource API in helpers.ts. Lifecycle model
// (nix-style generations): the manifest is the desired state, the machine is
// the actual state, and ~/.local/state/fleet.json is the previous
// generation — the resource keys the last apply put on this machine.
//   + create   desired, missing on the machine
//   ~ update   desired, present but differs (file content, outdated package)
//   - delete   in the previous generation, no longer desired
//   = adopt    desired and already there, but not tracked yet — pure
//              bookkeeping: the key enters the generation, the machine is
//              left exactly as it is
// diff/plan prints the plan without touching anything; apply executes it and
// records the new generation. Deletes need the state file — the machine
// alone can't tell fleet-owned things from manually installed ones, which
// are never touched.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import { fail, run } from "./exec.ts";
import { hosts } from "./manifest.ts";
import { destroyerFor, flatten, type Resource } from "./resource.ts";

const repoRoot = path.resolve(import.meta.dirname, "..");
const home = os.homedir();

const { positionals, values: flags } = parseArgs({
  allowPositionals: true,
  options: {
    host: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const [command = "help", commandArg] = positionals;
const dryRun = flags["dry-run"];

function detectHost(): string {
  if (flags.host) return flags.host;
  const byOs = Object.entries(hosts).find(([, config]) => config.os === os.platform());
  if (!byOs) fail(`no host in manifest for platform ${os.platform()}`);
  return byOs[0];
}

function hostResources(hostName: string): Resource[] {
  const config = hosts[hostName];
  if (!config) fail(`unknown host: ${hostName}`);
  return flatten(config.items).filter((resource) => !resource.os || resource.os === config.os);
}

// ---- generations ----

const STATE_PATH = path.join(home, ".local/state/fleet.json");

function previousGeneration(): string[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    if (parsed.keys) return parsed.keys;
    // migrate the pre-resource {files, paru} format
    return [
      ...(parsed.files ?? []).map((target: string) => `file:${target}`),
      ...(parsed.paru ?? []).map((name: string) => `paru:${name}`),
    ];
  } catch {
    return [];
  }
}

function recordGeneration(keys: string[]) {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify({ keys }, null, 2) + "\n");
}

// ---- plan ----

interface Step {
  symbol: "+" | "~" | "-" | "=";
  key: string;
  execute(): void;
}

function computePlan(hostName: string): Step[] {
  const desired = hostResources(hostName);
  const previous = previousGeneration();
  const tracked = new Set(previous);
  const steps: Step[] = [];
  for (const resource of desired) {
    const symbol = resource.plan(tracked);
    if (symbol) steps.push({ symbol, key: resource.key, execute: () => resource.apply() });
  }
  const desiredKeys = new Set(desired.map((resource) => resource.key));
  for (const key of previous) {
    if (desiredKeys.has(key)) continue;
    const kind = key.slice(0, key.indexOf(":"));
    const id = key.slice(key.indexOf(":") + 1);
    const destroy = destroyerFor(kind);
    if (destroy) steps.push({ symbol: "-", key, execute: () => destroy(id) });
  }
  return steps;
}

// ---- commands ----

function diff(hostName: string) {
  console.log(`Plan for ${hostName} (+ create, ~ update, - delete, = adopt)\n`);
  const steps = computePlan(hostName);
  if (!steps.length) console.log("  all up to date");
  for (const step of steps) console.log(`  ${step.symbol} ${step.key}`);
}

function apply(hostName: string) {
  console.log(`Applying ${hostName}${dryRun ? " (dry run)" : ""}`);
  const steps = computePlan(hostName);
  if (!steps.length) console.log("  all up to date");
  for (const step of steps) {
    console.log(`  ${step.symbol} ${step.key}`);
    if (!dryRun && step.symbol !== "=") step.execute();
  }
  const sshDir = path.join(home, ".ssh");
  if (!dryRun && fs.existsSync(sshDir)) fs.chmodSync(sshDir, 0o700);
  recordGeneration(hostResources(hostName).map((resource) => resource.key));
  console.log("done");
}

function deploy(hostName: string) {
  const host = hosts[hostName];
  if (!host) fail(`unknown host: ${hostName}`);
  run([
    "rsync",
    "--archive",
    "--delete",
    "--exclude-from",
    path.join(repoRoot, ".gitignore"),
    "--exclude",
    "node_modules",
    "--exclude",
    ".git",
    `${repoRoot}/`,
    `${hostName}:.fleet/`,
  ]);
  run([
    "ssh",
    hostName,
    `[ -f "$HOME/.vite-plus/env" ] && . "$HOME/.vite-plus/env"; ` +
      `node "$HOME/.fleet/src/cli.ts" apply --host ${hostName}`,
  ]);
}

switch (command) {
  case "apply":
    apply(detectHost());
    break;
  case "diff":
  case "plan":
    diff(detectHost());
    break;
  case "deploy":
    if (!commandArg) fail("usage: fleet deploy <host>");
    deploy(commandArg);
    break;
  default:
    console.log(
      "usage: node src/cli.ts <apply|diff|plan> [--host name] [--dry-run]\n" + "       node src/cli.ts deploy <host>",
    );
}
