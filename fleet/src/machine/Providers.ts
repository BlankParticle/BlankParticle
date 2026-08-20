import * as Provider from "alchemy/Provider";
import type { ResourceClassLike } from "alchemy/Resource";
import type { StackServices } from "alchemy/Stack";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import type * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import type * as Path from "effect/Path";

import { LocalBackendLayer, SSHBackendLayer } from "./Backend.ts";
import { ClaudeProviders } from "./Claude.ts";
import { CodexProviders } from "./Codex.ts";
import type { Command } from "./Command.ts";
import type { Elevation } from "./Elevation.ts";
import { UnsupportedPlatformError } from "./Errors.ts";
import { FileProviders } from "./File.ts";
import type { MachineFileSystem } from "./FileSystem.ts";
import { HomebrewProviders } from "./Homebrew.ts";
import { ManagedPath, ManagedPathLayer } from "./ManagedPath.ts";
import { ParuProviders } from "./Paru.ts";
import { TargetPlatform, TargetPlatformLayer } from "./Platform.ts";
import { VitePlusProviders } from "./VitePlus.ts";
import { ZshProviders } from "./Zsh.ts";

export class FleetProviders extends Context.Service<FleetProviders, Provider.ProviderCollectionService>()("Fleet") {
  declare readonly kind: "ProviderCollection";
}

const forPlatform = Effect.fn("Fleet.Platform.for")(function* <
  Darwin,
  DarwinError,
  DarwinRequirements,
  Linux,
  LinuxError,
  LinuxRequirements,
>(cases: {
  readonly darwin: Effect.Effect<Darwin, DarwinError, DarwinRequirements>;
  readonly linux: Effect.Effect<Linux, LinuxError, LinuxRequirements>;
}) {
  const target = yield* TargetPlatform;
  const platform = yield* target.detect.pipe(Effect.orDie);
  if (platform.os === "darwin") return yield* cases.darwin;
  if (platform.os === "linux") return yield* cases.linux;
  return yield* Effect.die(
    new UnsupportedPlatformError({
      provider: "Fleet.Platform",
      expected: "macOS or Linux",
      actual: platform.distribution ? `${platform.distribution} ${platform.os}` : platform.os,
    }),
  );
});

/** Plan-time selection using the platform detected through the active backend. */
export const Platform = { for: forPlatform };

export interface ProviderModule {
  // Alchemy's invariant resource/provider types need an existential `any` at
  // this module boundary; concrete resource modules remain fully typed.
  // oxlint-disable-next-line typescript/no-explicit-any
  readonly resources: readonly ResourceClassLike<any>[];
  readonly layer: Layer.Layer<
    // oxlint-disable-next-line typescript/no-explicit-any
    any,
    never,
    Command | Elevation | FileSystem.FileSystem | MachineFileSystem | ManagedPath | Path.Path | TargetPlatform
  >;
}

const providerCollection = (first: ProviderModule, ...rest: readonly ProviderModule[]) =>
  Layer.effect(
    FleetProviders,
    Effect.gen(function* () {
      const providers = yield* Provider.collection([first, ...rest].flatMap(({ resources }) => resources));
      return providers;
    }),
  ).pipe(Layer.provideMerge(Layer.mergeAll(first.layer, ...rest.map(({ layer }) => layer))));

export interface SSHConfig {
  readonly host: string;
}

export type Backend = Layer.Layer<Command | Elevation | MachineFileSystem, never, StackServices>;

const SelectedBackend = Context.Reference<Backend>("Fleet/Backend", {
  defaultValue: () => LocalBackendLayer,
});

/** The complete machine provider set, targeting the local machine by default. */
export const Providers = () =>
  Layer.unwrap(
    Effect.gen(function* () {
      const backend = yield* SelectedBackend;
      const platform = TargetPlatformLayer.pipe(Layer.provide(backend));
      const managedPath = ManagedPathLayer.pipe(Layer.provide(backend));
      const runtime = Layer.mergeAll(backend, platform, managedPath);
      return providerCollection(
        FileProviders,
        HomebrewProviders,
        ParuProviders,
        VitePlusProviders,
        ClaudeProviders,
        CodexProviders,
        ZshProviders,
      ).pipe(Layer.provideMerge(runtime));
    }),
  );

/** Plug a command and file-operation transport into Fleet.Providers(). */
export const Backend = (backend: Backend) => Layer.provide(Layer.succeed(SelectedBackend, backend));

/** Run commands and machine file operations through SSH. */
export const SSHBackend = ({ host }: SSHConfig) => Backend(SSHBackendLayer(host).pipe(Layer.orDie));
