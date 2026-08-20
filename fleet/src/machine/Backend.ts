import * as Layer from "effect/Layer";

import { LocalCommand, LocalProcess, SshCommand } from "./Command.ts";
import { SudoElevationLayer } from "./Elevation.ts";
import { LocalFileSystem, SshFileSystem } from "./FileSystem.ts";

const LocalCommandLayer = LocalCommand.pipe(Layer.provide(LocalProcess.layer));
const LocalElevationLayer = SudoElevationLayer.pipe(Layer.provide(LocalCommandLayer));
export const LocalBackendLayer = Layer.mergeAll(LocalCommandLayer, LocalFileSystem, LocalElevationLayer);

export const SSHBackendLayer = (host: string) => {
  const process = LocalProcess.layer;
  const command = SshCommand(host).pipe(Layer.provide(process));
  const transport = Layer.merge(process, command);
  const elevation = SudoElevationLayer.pipe(Layer.provide(command));
  return Layer.mergeAll(command, SshFileSystem(host).pipe(Layer.provide(transport)), elevation);
};
