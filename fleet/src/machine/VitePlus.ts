// The vite-plus toolchain: Fleet.VitePlus.Toolchain (vp itself),
// Fleet.VitePlus.Node, Fleet.VitePlus.Default, and
// Fleet.VitePlus.Global. Its service owns per-run probes and caches.
import { Resource } from "alchemy";
import { Unowned } from "alchemy/AdoptPolicy";
import { isResolved } from "alchemy/Diff";
import * as Namespace from "alchemy/Namespace";
import * as Provider from "alchemy/Provider";
import * as Cache from "effect/Cache";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { capture, Command, sh } from "./Command.ts";
import { VersionResolutionError } from "./Errors.ts";
import { MachineFileSystem } from "./FileSystem.ts";
import type { FleetProviders, ProviderModule } from "./Providers.ts";
import { Source as ZshSource } from "./Zsh.ts";

// "t3@nightly" -> "t3", "@scope/name" -> itself
const globalName = (spec: string) => {
  const at = spec.lastIndexOf("@");
  return at > 0 ? spec.slice(0, at) : spec;
};

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
const InstalledNodes = Schema.fromJsonString(Schema.Array(Schema.Struct({ version: Schema.String })));
const RemoteNodes = Schema.fromJsonString(
  Schema.Struct({ versions: Schema.Array(Schema.Struct({ version: Schema.String })) }),
);

const makeVitePlus = Effect.gen(function* () {
  const machine = yield* MachineFileSystem;
  const command = yield* Command;
  const path = yield* Path.Path;
  const home = path.join(machine.home, ".vite-plus");
  const paths = { home, bin: path.join(home, "bin/vp") };
  const installed = machine.exists(paths.bin);

  const [nodes, invalidateNodes] = yield* Effect.cachedInvalidateWithTTL(
    Effect.gen(function* () {
      const decoded = yield* Schema.decodeUnknownEffect(InstalledNodes)(
        (yield* command.run([paths.bin, "env", "list", "--json"])).output,
      );
      return new Set(decoded.map(({ version }) => version));
    }),
    Duration.infinity,
  );

  const latestNodes = yield* Cache.make({
    capacity: 32,
    lookup: Effect.fn(function* (spec: string) {
      const { versions } = yield* Schema.decodeUnknownEffect(RemoteNodes)(
        (yield* command.run([paths.bin, "env", "list-remote", spec, "--sort", "desc", "--json"])).output,
      );
      const version = versions[0]?.version;
      if (!version)
        return yield* Effect.fail(new VersionResolutionError({ tool: "vite-plus", spec: `Node.js ${spec}` }));
      return version;
    }),
  });

  const [globals, invalidateGlobals] = yield* Effect.cachedInvalidateWithTTL(
    Effect.gen(function* () {
      const packages = yield* Schema.decodeUnknownEffect(GlobalPackages)(
        (yield* command.run([paths.bin, "list", "--global", "--json"])).output,
      );
      return new Map(packages.map(({ name, platform, version }) => [name, { version, node: platform.node }]));
    }),
    Duration.infinity,
  );

  const latestPackages = yield* Cache.make({
    capacity: 128,
    lookup: Effect.fn(function* (spec: string) {
      return yield* Schema.decodeUnknownEffect(PackageVersion)(
        (yield* command.run([paths.bin, "info", spec, "version", "--json"])).output,
      );
    }),
  });

  return {
    paths,
    installed,
    nodes,
    invalidateNodes,
    latestNode: (spec: string) => Cache.get(latestNodes, spec),
    globals,
    refreshGlobals: invalidateGlobals.pipe(Effect.andThen(globals)),
    latest: (spec: string) => Cache.get(latestPackages, spec),
    currentDefault: Effect.map(
      capture([paths.bin, "env", "default"]),
      ({ output }) => /Default Node\.js version: (\S+)/.exec(output)?.[1],
    ),
  };
});

type VitePlus = Effect.Success<typeof makeVitePlus>;
const VitePlus = Context.Service<VitePlus>("Fleet/VitePlus");
const VitePlusLayer = Layer.effect(VitePlus, makeVitePlus);
const paths = Effect.map(VitePlus, ({ paths }) => paths);
const installed = Effect.flatMap(VitePlus, ({ installed }) => installed);
const nodes = Effect.flatMap(VitePlus, ({ nodes }) => nodes);
const invalidateNodes = Effect.flatMap(VitePlus, ({ invalidateNodes }) => invalidateNodes);
const latestNode = (spec: string) => Effect.flatMap(VitePlus, ({ latestNode }) => latestNode(spec));
const globals = Effect.flatMap(VitePlus, ({ globals }) => globals);
const refreshGlobals = Effect.flatMap(VitePlus, ({ refreshGlobals }) => refreshGlobals);
const latest = (spec: string) => Effect.flatMap(VitePlus, ({ latest }) => latest(spec));
const currentDefault = Effect.flatMap(VitePlus, ({ currentDefault }) => currentDefault);

// ---- Fleet.VitePlus.Toolchain ----

export type Toolchain = Resource<
  "Fleet.VitePlus.Toolchain",
  { version?: string },
  { bin: string },
  never,
  FleetProviders
>;
const ToolchainResource = Resource<Toolchain>("Fleet.VitePlus.Toolchain");

export const Toolchain = Effect.fn("Fleet.VitePlus.Toolchain")(
  function* (id: string, props: { version?: string } = {}) {
    const toolchain = yield* ToolchainResource("toolchain", props);
    yield* ZshSource("vite-plus", {
      path: "$HOME/.vite-plus/env",
      dependsOn: toolchain,
    });
    return toolchain;
  },
  (effect, id: string) => effect.pipe(Namespace.push(id)),
);

export const ToolchainProvider = () =>
  Provider.succeed(
    ToolchainResource,
    ToolchainResource.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* () {
        if (!(yield* installed)) return { action: "update" as const };
        const { bin } = yield* paths;
        const check = (yield* capture([bin, "upgrade", "--check"])).output;
        return check.includes("Already up to date") ? { action: "noop" as const } : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ olds, output }) {
        if (olds === undefined && output !== undefined) return output;
        const { bin, home } = yield* paths;
        if (!(yield* installed))
          yield* sh(["/bin/bash", "-c", "curl -fsSL https://vite.plus | bash"], { env: { VP_HOME: home } });
        else {
          const check = (yield* capture([bin, "upgrade", "--check"])).output;
          if (check.includes("Already up to date")) return { bin };
          yield* sh([bin, "upgrade"]);
        }
        yield* sh([bin, "env", "setup", "--refresh"]);
        return { bin };
      }),
      // dropping the toolchain from the stack just untracks it; removing it
      // for real is `vp implode`, too destructive to automate
      delete: () => Effect.void,
      read: Effect.fn(function* () {
        const { bin } = yield* paths;
        return (yield* installed) ? { bin } : undefined;
      }),
    }),
  );

// ---- Fleet.VitePlus.Node ----

export type Node = Resource<"Fleet.VitePlus.Node", { version: string }, { version: string }, never, FleetProviders>;
export const Node = Resource<Node>("Fleet.VitePlus.Node");

export const NodeProvider = () =>
  Provider.succeed(
    Node,
    Node.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        return (yield* nodes).has(yield* latestNode(news.version))
          ? { action: "noop" as const }
          : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ news, olds, output }) {
        if (olds === undefined && output !== undefined) return output;
        const { bin } = yield* paths;
        const version = yield* latestNode(news.version);
        if (!(yield* nodes).has(version)) {
          yield* sh([bin, "env", "install", version]);
          yield* invalidateNodes;
        }
        return { version };
      }),
      delete: Effect.fn(function* ({ output }) {
        const { bin } = yield* paths;
        yield* sh([bin, "env", "uninstall", output.version], { allowFailure: true });
      }),
      read: Effect.fn(function* ({ olds }) {
        if (!olds?.version) return undefined;
        const installedNodes = Array.from(yield* nodes);
        const current = yield* latestNode(olds.version);
        const resolved = installedNodes.includes(current)
          ? current
          : installedNodes.findLast((version) => version.startsWith(`${olds.version}.`));
        return resolved ? { version: resolved } : undefined;
      }),
    }),
  );

// ---- Fleet.VitePlus.Default ----

export type Default = Resource<
  "Fleet.VitePlus.Default",
  { version: string },
  { version: string },
  never,
  FleetProviders
>;
export const Default = Resource<Default>("Fleet.VitePlus.Default");

export const DefaultProvider = () =>
  Provider.succeed(
    Default,
    Default.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        return (yield* currentDefault) === (yield* latestNode(news.version))
          ? { action: "noop" as const }
          : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ news, olds, output }) {
        if (olds === undefined && output !== undefined) return output;
        const { bin } = yield* paths;
        const version = yield* latestNode(news.version);
        if ((yield* currentDefault) !== version) yield* sh([bin, "env", "default", version]);
        return { version };
      }),
      delete: () => Effect.void,
      read: Effect.fn(function* ({ olds }) {
        if (!olds?.version) return undefined;
        const current = yield* currentDefault;
        if (!current) return undefined;
        const attributes = { version: current };
        return current.startsWith(`${olds.version}.`) ? attributes : Unowned(attributes);
      }),
    }),
  );

// ---- Fleet.VitePlus.Global ----

export type Global = Resource<
  "Fleet.VitePlus.Global",
  { spec: string; node: string },
  { name: string; version: string; node: string },
  never,
  FleetProviders
>;
export const Global = Resource<Global>("Fleet.VitePlus.Global");

export const GlobalProvider = () =>
  Provider.succeed(
    Global,
    Global.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        const installed = (yield* globals).get(globalName(news.spec));
        const [version, node] = yield* Effect.all([latest(news.spec), latestNode(news.node)]);
        return installed?.version === version && installed.node === node
          ? { action: "noop" as const }
          : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ news, olds, output }) {
        if (olds === undefined && output !== undefined) return output;
        const { bin } = yield* paths;
        const node = yield* latestNode(news.node);
        const name = globalName(news.spec);
        const current = (yield* globals).get(name);
        const version = yield* latest(news.spec);
        if (current?.version === version && current.node === node) return { name, ...current };
        yield* sh([bin, "install", "--global", "--node", node, news.spec]);
        const installed = (yield* refreshGlobals).get(name);
        return {
          name,
          version: installed?.version ?? version,
          node: installed?.node ?? node,
        };
      }),
      delete: Effect.fn(function* ({ output }) {
        const { bin } = yield* paths;
        yield* sh([bin, "uninstall", "--global", output.name], { allowFailure: true });
      }),
      read: Effect.fn(function* ({ olds }) {
        if (!olds?.spec) return undefined;
        const name = globalName(olds.spec);
        const installed = (yield* globals).get(name);
        return installed ? { name, ...installed } : undefined;
      }),
    }),
  );

export const VitePlusProviders: ProviderModule = {
  resources: [ToolchainResource, Node, Default, Global],
  layer: Layer.mergeAll(ToolchainProvider(), NodeProvider(), DefaultProvider(), GlobalProvider()).pipe(
    Layer.provideMerge(VitePlusLayer),
  ),
};
