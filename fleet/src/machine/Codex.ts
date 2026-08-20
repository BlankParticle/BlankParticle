import { Resource } from "alchemy";
import { Unowned } from "alchemy/AdoptPolicy";
import { isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import type { Content } from "../content.ts";
import { Command } from "./Command.ts";
import { ManagedPath } from "./ManagedPath.ts";
import type { FleetProviders, ProviderModule } from "./Providers.ts";

const Package = "@openai/codex";
const GlobalPackages = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      name: Schema.String,
      version: Schema.String,
      platform: Schema.Struct({ node: Schema.String }),
    }),
  ),
);
const PackageVersion = Schema.fromJsonString(Schema.String);

interface ToolchainProps {
  readonly vitePlus: { readonly bin: string };
  readonly node: { readonly version: string };
}

interface ToolchainAttributes {
  readonly version: string;
  readonly node: string;
}

export type Toolchain = Resource<"Fleet.Codex.Toolchain", ToolchainProps, ToolchainAttributes, never, FleetProviders>;
export const Toolchain = Resource<Toolchain>("Fleet.Codex.Toolchain");

export const ToolchainProvider = () =>
  Provider.succeed(
    Toolchain,
    Toolchain.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        const command = yield* Command;
        const packages = yield* Schema.decodeUnknownEffect(GlobalPackages)(
          (yield* command.run([news.vitePlus.bin, "list", "--global", "--json"])).output,
        );
        const installed = packages.find(({ name }) => name === Package);
        const latest = yield* Schema.decodeUnknownEffect(PackageVersion)(
          (yield* command.run([news.vitePlus.bin, "info", Package, "version", "--json"])).output,
        );
        return installed?.version === latest && installed.platform.node === news.node.version
          ? { action: "noop" as const }
          : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ news, olds, output }) {
        if (olds === undefined && output !== undefined) return output;
        const command = yield* Command;
        const packages = yield* Schema.decodeUnknownEffect(GlobalPackages)(
          (yield* command.run([news.vitePlus.bin, "list", "--global", "--json"])).output,
        );
        const current = packages.find(({ name }) => name === Package);
        const latest = yield* Schema.decodeUnknownEffect(PackageVersion)(
          (yield* command.run([news.vitePlus.bin, "info", Package, "version", "--json"])).output,
        );
        if (current?.version === latest && current.platform.node === news.node.version)
          return { version: current.version, node: current.platform.node };
        yield* command.run([news.vitePlus.bin, "install", "--global", "--node", news.node.version, Package]);
        const refreshed = yield* Schema.decodeUnknownEffect(GlobalPackages)(
          (yield* command.run([news.vitePlus.bin, "list", "--global", "--json"])).output,
        );
        const installed = refreshed.find(({ name }) => name === Package);
        return { version: installed?.version ?? latest, node: installed?.platform.node ?? news.node.version };
      }),
      delete: Effect.fn(function* ({ olds }) {
        if (olds?.vitePlus.bin) {
          yield* (yield* Command).run([olds.vitePlus.bin, "uninstall", "--global", Package], {
            allowFailure: true,
          });
        }
      }),
      read: Effect.fn(function* ({ olds }) {
        const bin = olds?.vitePlus?.bin;
        if (!bin) return undefined;
        const result = yield* (yield* Command).run([bin, "list", "--global", "--json"], {
          allowFailure: true,
        });
        if (result.exitCode !== 0) return undefined;
        const packages = yield* Schema.decodeUnknownEffect(GlobalPackages)(result.output);
        const installed = packages.find(({ name }) => name === Package);
        return installed ? { version: installed.version, node: installed.platform.node } : undefined;
      }),
    }),
  );

interface PathAttributes {
  readonly path: string;
}

export type Instructions = Resource<"Fleet.Codex.Instructions", Content, PathAttributes, never, FleetProviders>;
export const Instructions = Resource<Instructions>("Fleet.Codex.Instructions");

export const InstructionsProvider = () =>
  Provider.succeed(
    Instructions,
    Instructions.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        const managed = yield* ManagedPath;
        return (yield* managed.converged({ target: ".codex/AGENTS.md", ...news }))
          ? { action: "noop" as const }
          : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ news }) {
        return yield* (yield* ManagedPath).write({ target: ".codex/AGENTS.md", ...news });
      }),
      delete: Effect.fn(function* ({ output }) {
        yield* (yield* ManagedPath).remove(output.path);
      }),
      read: Effect.fn(function* ({ olds }) {
        if (!olds) return undefined;
        const managed = yield* ManagedPath;
        const path = managed.resolve(".codex/AGENTS.md");
        if (!(yield* managed.exists(path))) return undefined;
        const attributes = { path };
        return (yield* managed.converged({ target: ".codex/AGENTS.md", ...olds })) ? attributes : Unowned(attributes);
      }),
    }),
  );

export type Skill = Resource<
  "Fleet.Codex.Skill",
  Content & { readonly name: string },
  PathAttributes,
  never,
  FleetProviders
>;
export const Skill = Resource<Skill>("Fleet.Codex.Skill");

export const SkillProvider = () =>
  Provider.succeed(
    Skill,
    Skill.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        const managed = yield* ManagedPath;
        return (yield* managed.converged({
          target: `.codex/skills/${news.name}/${news.source.filename ?? "SKILL.md"}`,
          ...news,
        }))
          ? { action: "noop" as const }
          : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ news }) {
        const managed = yield* ManagedPath;
        yield* managed.write({
          target: `.codex/skills/${news.name}/${news.source.filename ?? "SKILL.md"}`,
          ...news,
        });
        return { path: managed.resolve(`.codex/skills/${news.name}`) };
      }),
      delete: Effect.fn(function* ({ output }) {
        yield* (yield* ManagedPath).remove(output.path);
      }),
      read: Effect.fn(function* ({ olds }) {
        if (!olds?.name) return undefined;
        const managed = yield* ManagedPath;
        const props = {
          target: `.codex/skills/${olds.name}/${olds.source.filename ?? "SKILL.md"}`,
          ...olds,
        };
        const path = managed.resolve(props.target);
        if (!(yield* managed.exists(path))) return undefined;
        const attributes = { path: managed.resolve(`.codex/skills/${olds.name}`) };
        return (yield* managed.converged(props)) ? attributes : Unowned(attributes);
      }),
    }),
  );

export const CodexProviders: ProviderModule = {
  resources: [Toolchain, Instructions, Skill],
  layer: Layer.mergeAll(ToolchainProvider(), InstructionsProvider(), SkillProvider()),
};
