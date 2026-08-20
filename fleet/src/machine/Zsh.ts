import { Resource } from "alchemy";
import { Unowned } from "alchemy/AdoptPolicy";
import { isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import type { Content } from "../content.ts";
import { ManagedPath } from "./ManagedPath.ts";
import type { FleetProviders, ProviderModule } from "./Providers.ts";

export interface EnvironmentProps {
  readonly dependsOn?: unknown;
  readonly statements?: readonly string[];
  readonly paths?: readonly string[];
  readonly variables?: Readonly<Record<string, string>>;
  readonly defaults?: Readonly<Record<string, string>>;
  readonly aliases?: Readonly<Record<string, string | { readonly command: string; readonly global?: boolean }>>;
  readonly sources?: readonly string[];
}

interface PathAttributes {
  readonly path: string;
}

const makeZsh = Effect.sync(() => {
  const doubleQuote = (value: string) =>
    `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("`", "\\`")}"`;
  const singleQuote = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;
  const alias = (name: string, value: string, global: boolean) =>
    `alias ${global ? "-g " : ""}${name.startsWith("-") ? "-- " : ""}${name}=${singleQuote(value)}`;

  return {
    source: (props: SourceProps) =>
      "path" in props
        ? `[[ -f ${doubleQuote(props.path)} ]] && source ${doubleQuote(props.path)}\n`
        : `eval "$(${props.evaluate.map(singleQuote).join(" ")})"\n`,
    environment: (props: EnvironmentProps) =>
      [
        "typeset -U path",
        "",
        ...(props.statements ?? []),
        ...(props.statements?.length ? [""] : []),
        ...Object.entries(props.variables ?? {}).map(([name, value]) => `export ${name}=${doubleQuote(value)}`),
        ...Object.entries(props.defaults ?? {}).map(
          ([name, value]) => `[[ -z "$${name}" ]] && export ${name}=${doubleQuote(value)}`,
        ),
        "",
        ...(props.paths?.length
          ? ["path=(", ...props.paths.map((entry) => `  ${doubleQuote(entry)}`), "  $path", ")", "export PATH", ""]
          : []),
        ...Object.entries(props.aliases ?? {}).map(([name, value]) =>
          typeof value === "string" ? alias(name, value, false) : alias(name, value.command, value.global ?? false),
        ),
        "",
        ...(props.sources ?? []).map((source) => `[[ -f ${doubleQuote(source)} ]] && source ${doubleQuote(source)}`),
        'for _zshenv_fragment in "$HOME/.config/zsh/env.d/"*.zsh(N); do',
        '  source "$_zshenv_fragment"',
        "done",
        "unset _zshenv_fragment",
        "",
      ].join("\n"),
  };
});

type Zsh = Effect.Success<typeof makeZsh>;
const Zsh = Context.Service<Zsh>("Fleet/Zsh");
const ZshLayer = Layer.effect(Zsh, makeZsh);

export type Environment = Resource<"Fleet.Zsh.Environment", EnvironmentProps, PathAttributes, never, FleetProviders>;
export const Environment = Resource<Environment>("Fleet.Zsh.Environment");

export const EnvironmentProvider = () =>
  Provider.succeed(
    Environment,
    Environment.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        const [zsh, managed] = yield* Effect.all([Zsh, ManagedPath]);
        return (yield* managed.converged({ target: ".zshenv", content: zsh.environment(news) }))
          ? { action: "noop" as const }
          : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ news }) {
        const [zsh, managed] = yield* Effect.all([Zsh, ManagedPath]);
        return yield* managed.write({ target: ".zshenv", content: zsh.environment(news) });
      }),
      delete: Effect.fn(function* ({ output }) {
        yield* (yield* ManagedPath).remove(output.path);
      }),
      read: Effect.fn(function* ({ olds }) {
        if (!olds) return undefined;
        const [zsh, managed] = yield* Effect.all([Zsh, ManagedPath]);
        const path = managed.resolve(".zshenv");
        if (!(yield* managed.exists(path))) return undefined;
        const attributes = { path };
        return (yield* managed.converged({ target: ".zshenv", content: zsh.environment(olds) }))
          ? attributes
          : Unowned(attributes);
      }),
    }),
  );

export type SourceProps =
  | { readonly path: string; readonly dependsOn?: unknown }
  | { readonly evaluate: readonly [string, ...string[]]; readonly dependsOn?: unknown };

export type Source = Resource<"Fleet.Zsh.Source", SourceProps, PathAttributes, never, FleetProviders>;
export const Source = Resource<Source>("Fleet.Zsh.Source");

export const SourceProvider = () =>
  Provider.succeed(
    Source,
    Source.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ id, news }) {
        if (!isResolved(news)) return undefined;
        const [zsh, managed] = yield* Effect.all([Zsh, ManagedPath]);
        return (yield* managed.converged({
          target: `.config/zsh/env.d/${id}.zsh`,
          content: zsh.source(news),
        }))
          ? { action: "noop" as const }
          : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ id, news }) {
        const [zsh, managed] = yield* Effect.all([Zsh, ManagedPath]);
        return yield* managed.write({
          target: `.config/zsh/env.d/${id}.zsh`,
          content: zsh.source(news),
        });
      }),
      delete: Effect.fn(function* ({ output }) {
        yield* (yield* ManagedPath).remove(output.path);
      }),
      read: Effect.fn(function* ({ id, olds }) {
        if (!olds) return undefined;
        const [zsh, managed] = yield* Effect.all([Zsh, ManagedPath]);
        const props = {
          target: `.config/zsh/env.d/${id}.zsh`,
          content: zsh.source(olds),
        };
        const path = managed.resolve(props.target);
        if (!(yield* managed.exists(path))) return undefined;
        const attributes = { path };
        return (yield* managed.converged(props)) ? attributes : Unowned(attributes);
      }),
    }),
  );

export type Runtime = Resource<
  "Fleet.Zsh.Runtime",
  Content & { readonly dependsOn?: unknown },
  PathAttributes,
  never,
  FleetProviders
>;
export const Runtime = Resource<Runtime>("Fleet.Zsh.Runtime");

export const RuntimeProvider = () =>
  Provider.succeed(
    Runtime,
    Runtime.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        return (yield* (yield* ManagedPath).converged({ target: ".zshrc", ...news }))
          ? { action: "noop" as const }
          : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ news }) {
        return yield* (yield* ManagedPath).write({ target: ".zshrc", ...news });
      }),
      delete: Effect.fn(function* ({ output }) {
        yield* (yield* ManagedPath).remove(output.path);
      }),
      read: Effect.fn(function* ({ olds }) {
        if (!olds) return undefined;
        const managed = yield* ManagedPath;
        const path = managed.resolve(".zshrc");
        if (!(yield* managed.exists(path))) return undefined;
        const attributes = { path };
        return (yield* managed.converged({ target: ".zshrc", ...olds })) ? attributes : Unowned(attributes);
      }),
    }),
  );

export type Profile = Resource<"Fleet.Zsh.Profile", Content, PathAttributes, never, FleetProviders>;
export const Profile = Resource<Profile>("Fleet.Zsh.Profile");

export const ProfileProvider = () =>
  Provider.succeed(
    Profile,
    Profile.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        return (yield* (yield* ManagedPath).converged({ target: ".zprofile", ...news }))
          ? { action: "noop" as const }
          : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ news }) {
        return yield* (yield* ManagedPath).write({ target: ".zprofile", ...news });
      }),
      delete: Effect.fn(function* ({ output }) {
        yield* (yield* ManagedPath).remove(output.path);
      }),
      read: Effect.fn(function* ({ olds }) {
        if (!olds) return undefined;
        const managed = yield* ManagedPath;
        const path = managed.resolve(".zprofile");
        if (!(yield* managed.exists(path))) return undefined;
        const attributes = { path };
        return (yield* managed.converged({ target: ".zprofile", ...olds })) ? attributes : Unowned(attributes);
      }),
    }),
  );

export const ZshProviders: ProviderModule = {
  resources: [Environment, Source, Runtime, Profile],
  layer: Layer.mergeAll(EnvironmentProvider(), SourceProvider(), RuntimeProvider(), ProfileProvider()).pipe(
    Layer.provideMerge(ZshLayer),
  ),
};
