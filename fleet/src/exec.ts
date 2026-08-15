// Process helpers shared by the CLI driver and the resources.
import { spawnSync } from "node:child_process";

export function fail(message: string): never {
  console.error(`fleet: ${message}`);
  process.exit(1);
}

export function run(
  argv: string[],
  options: { env?: Record<string, string>; allowFailure?: boolean; input?: string; dryRun?: boolean } = {},
) {
  console.log(`$ ${argv.join(" ")}`);
  if (options.dryRun) return;
  const result = spawnSync(argv[0], argv.slice(1), {
    stdio: [options.input === undefined ? "inherit" : "pipe", "inherit", "inherit"],
    input: options.input,
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0 && !options.allowFailure)
    fail(`command failed (exit ${result.status ?? result.error?.message}): ${argv.join(" ")}`);
}

export const capture = (argv: string[]) => spawnSync(argv[0], argv.slice(1), { encoding: "utf8" });
