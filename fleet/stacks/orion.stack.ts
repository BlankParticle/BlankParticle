import { StageInvariant } from "@blankparticle/utils/alchemy";
import * as Alchemy from "alchemy";
import * as Namespace from "alchemy/Namespace";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as Fleet from "../src/machine/index.ts";
import { Agents, Dotfiles, Git, Ssh, Toolchain, Zsh } from "../src/shared.ts";

export default Alchemy.Stack(
  "fleet-orion",
  {
    providers: Fleet.Providers().pipe(Fleet.SSHBackend({ host: "orion" })),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    yield* StageInvariant(Schema.Literal("prod")).pipe(Effect.orDie);

    yield* Dotfiles;
    yield* Zsh;
    yield* Git;
    yield* Ssh;
    yield* Agents;
    yield* Toolchain;

    yield* Effect.all(
      ["btop", "rsync"].map((name) => Fleet.Paru.Package(name, { name })),
      {
        concurrency: "unbounded",
        discard: true,
      },
    ).pipe(Namespace.push("packages"));
  }),
);
