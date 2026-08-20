import { Resource } from "alchemy";
import { Unowned } from "alchemy/AdoptPolicy";
import { isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import * as Effect from "effect/Effect";

import type { Content } from "../content.ts";
import { ManagedPath } from "./ManagedPath.ts";
import type { FleetProviders, ProviderModule } from "./Providers.ts";

export type FileProps = Content & {
  /** Destination, relative to $HOME. */
  readonly target: string;
  /** POSIX permissions applied to the destination. */
  readonly mode?: number;
  /** Resource outputs that must be reconciled before this file. */
  readonly dependsOn?: unknown;
};

export interface FileAttributes {
  readonly path: string;
}

export const File = Resource<Resource<"Fleet.File", FileProps, FileAttributes, never, FleetProviders>>("Fleet.File");

export const FileProvider = () =>
  Provider.succeed(
    File,
    File.Provider.of({
      list: () => Effect.succeed([]),
      diff: Effect.fn(function* ({ news }) {
        if (!isResolved(news)) return undefined;
        return (yield* (yield* ManagedPath).converged(news))
          ? { action: "noop" as const }
          : { action: "update" as const };
      }),
      reconcile: Effect.fn(function* ({ news }) {
        return yield* (yield* ManagedPath).write(news);
      }),
      delete: Effect.fn(function* ({ output }) {
        yield* (yield* ManagedPath).remove(output.path);
      }),
      read: Effect.fn(function* ({ olds }) {
        if (!olds) return undefined;
        const managed = yield* ManagedPath;
        const path = managed.resolve(olds.target);
        if (!(yield* managed.exists(path))) return undefined;
        const attributes = { path };
        return (yield* managed.converged(olds)) ? attributes : Unowned(attributes);
      }),
    }),
  );

export const FileProviders: ProviderModule = {
  resources: [File],
  layer: FileProvider(),
};
