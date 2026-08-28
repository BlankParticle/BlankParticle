import { homedir } from "node:os";

import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Argument from "effect/unstable/cli/Argument";
import * as Command from "effect/unstable/cli/Command";

import { capture, exec, UserError } from "./runtime.ts";

const RepoView = Schema.Struct({ nameWithOwner: Schema.String, sshUrl: Schema.String });
const decodeRepoView = Schema.decodeUnknownSync(Schema.fromJsonString(RepoView));

/** Where clones land: `$BP_PROJECTS` or `~/Projects`, then `<owner>/<repo>` */
const projectsRoot = () => process.env.BP_PROJECTS ?? `${homedir()}/Projects`;

export const clone = Command.make(
  "clone",
  {
    repo: Argument.string("repo").pipe(Argument.withDescription("owner/repo or a GitHub URL")),
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
      if (yield* fs.exists(destination)) return yield* new UserError({ message: `${destination} already exists` });
      yield* fs.makeDirectory(path.dirname(destination), { recursive: true });

      const exitCode = yield* exec("git", ["clone", sshUrl, destination]);
      if (exitCode !== 0) return yield* new UserError({ message: `git clone exited with ${exitCode}` });
      yield* Console.log(`✔ ${destination}`);
    }),
).pipe(Command.withDescription("Clone a GitHub repo into ~/Projects/<owner>/<repo> (or $BP_PROJECTS)"));
