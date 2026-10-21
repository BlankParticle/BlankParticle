import { homedir } from "node:os";

import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { capture, exec, run, UserError } from "./runtime.ts";

const RepoView = Schema.Struct({ nameWithOwner: Schema.String, sshUrl: Schema.String });
const decodeRepoView = Schema.decodeUnknownSync(Schema.fromJsonString(RepoView));

/** Where clones land: `$BP_PROJECTS` or `~/Projects`, then `<owner>/<repo>` */
const projectsRoot = () => process.env.BP_PROJECTS ?? `${homedir()}/Projects`;

const git = (repo: string, ...args: string[]) => run("git", ["-C", repo, ...args]);

/** Files git reports as unmerged, i.e. left with conflict markers. */
const conflictedFiles = (repo: string) =>
  git(repo, "diff", "--name-only", "--diff-filter=U").pipe(
    Effect.map(({ stdout }) => (stdout === "" ? [] : stdout.split("\n"))),
  );

const conflictError = (repo: string, files: string[]) =>
  new UserError({
    message: [
      `${repo} has conflicts with upstream, update aborted and repo left as it was:`,
      ...files.map((file) => `  ${file}`),
    ].join("\n"),
  });

/** Pulls the current branch with `--rebase --autostash`, rolling everything back if anything conflicts. */
const update = (repo: string) =>
  Effect.gen(function* () {
    if ((yield* git(repo, "rev-parse", "--is-inside-work-tree")).stdout !== "true")
      return yield* new UserError({ message: `${repo} already exists and is not a git repository` });

    const before = (yield* git(repo, "rev-parse", "HEAD")).stdout;
    const pull = yield* git(repo, "pull", "--rebase", "--autostash");

    if (pull.exitCode !== 0) {
      const rebasing = yield* git(repo, "rev-parse", "-q", "--verify", "REBASE_HEAD");
      if (rebasing.exitCode !== 0)
        return yield* new UserError({ message: pull.stderr || `git pull failed in ${repo}` });
      // Local commits conflict with upstream; aborting the rebase also restores the autostash
      const files = yield* conflictedFiles(repo);
      yield* git(repo, "rebase", "--abort");
      return yield* conflictError(repo, files);
    }

    // The pull succeeded but re-applying the autostash conflicted: rewind and pop it onto the original commit
    const files = yield* conflictedFiles(repo);
    if (files.length > 0) {
      yield* git(repo, "reset", "--hard", before);
      yield* git(repo, "stash", "pop");
      return yield* conflictError(repo, files);
    }

    const after = (yield* git(repo, "rev-parse", "HEAD")).stdout;
    if (after === before) return yield* Console.log(`✔ ${repo} (already up to date)`);
    const count = (yield* git(repo, "rev-list", "--count", `${before}..@{upstream}`)).stdout;
    const branch = (yield* git(repo, "branch", "--show-current")).stdout;
    yield* Console.log(
      `✔ ${repo} updated ${branch} ${before.slice(0, 7)}..${after.slice(0, 7)} (${count} new commit${count === "1" ? "" : "s"})`,
    );
  });

export const clone = Command.make(
  "clone",
  {
    repo: Argument.String("repo").pipe(Argument.withDescription("owner/repo or a GitHub URL")),
  },
  ({ repo }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      // gh normalises "owner/repo", full URLs and the current repo; its stderr passes through on failure
      const view = yield* capture("gh", ["repo", "view", repo, "--json", "nameWithOwner,sshUrl"], {
        stderr: "inherit",
      });
      if (view === null) return yield* new UserError({ message: `gh could not resolve "${repo}"` });
      const { nameWithOwner, sshUrl } = decodeRepoView(view);

      const destination = path.join(projectsRoot(), nameWithOwner);
      if (yield* fs.exists(destination)) return yield* update(destination);
      yield* fs.makeDirectory(path.dirname(destination), { recursive: true });

      const exitCode = yield* exec("git", ["clone", sshUrl, destination]);
      if (exitCode !== 0) return yield* new UserError({ message: `git clone exited with ${exitCode}` });
      yield* Console.log(`✔ ${destination}`);
    }),
).pipe(
  Command.withDescription(
    "Clone a GitHub repo into ~/Projects/<owner>/<repo> (or $BP_PROJECTS), or update it if already cloned",
  ),
);
