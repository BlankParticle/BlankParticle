import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Command } from "./Command.ts";
import type { CommandFailure } from "./Errors.ts";
import { UnsupportedPlatformError } from "./Errors.ts";

export interface PlatformInfo {
  readonly os: string;
  readonly distribution?: string;
}

export type PlatformRequirement = { readonly os: "darwin" } | { readonly os: "linux"; readonly distribution: "arch" };

const display = ({ os, distribution }: PlatformInfo) => (distribution ? `${distribution} ${os}` : os);
const expected = (requirement: PlatformRequirement) =>
  requirement.os === "darwin" ? "macOS" : `${requirement.distribution} Linux`;

export class TargetPlatform extends Context.Service<
  TargetPlatform,
  {
    readonly detect: Effect.Effect<PlatformInfo, CommandFailure>;
    readonly require: (
      provider: string,
      requirement: PlatformRequirement,
    ) => Effect.Effect<void, CommandFailure | UnsupportedPlatformError>;
  }
>()("Fleet/TargetPlatform") {
  readonly kind = "Environment" as const;
}

export const TargetPlatformLayer = Layer.effect(
  TargetPlatform,
  Effect.gen(function* () {
    const command = yield* Command;
    const detect = yield* Effect.cached(
      Effect.gen(function* () {
        const os = (yield* command.run(["uname", "-s"])).output.trim().toLowerCase();
        const distribution =
          os === "linux"
            ? (yield* command.run(["/bin/sh", "-c", '. /etc/os-release 2>/dev/null && printf %s "$ID"'], {
                allowFailure: true,
              })).output
                .trim()
                .toLowerCase() || undefined
            : undefined;
        return { os, ...(distribution ? { distribution } : {}) };
      }),
    );

    return TargetPlatform.of({
      detect,
      require: Effect.fn(function* (provider, requirement) {
        const platform = yield* detect;
        const supported =
          platform.os === requirement.os &&
          (requirement.os === "darwin" || platform.distribution === requirement.distribution);
        if (!supported) {
          return yield* Effect.fail(
            new UnsupportedPlatformError({
              provider,
              expected: expected(requirement),
              actual: display(platform),
            }),
          );
        }
      }),
    });
  }),
);
