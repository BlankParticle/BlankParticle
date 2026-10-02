import * as Effect from "effect/Effect";

import { capture } from "./runtime.ts";

export const useDeviceLogin = (
  requested: boolean,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
) =>
  requested ||
  Boolean(env.SSH_CONNECTION || env.SSH_TTY) ||
  (platform !== "darwin" && (platform !== "linux" || !(env.DISPLAY || env.WAYLAND_DISPLAY)));

/** Best effort: the sign-in URL is always printed if no browser can be launched. */
export const openBrowser = (url: string) =>
  Effect.gen(function* () {
    if (process.platform === "darwin") {
      if ((yield* capture("open", ["-a", "Helium", url])) === null) yield* capture("open", [url]);
    } else if (process.platform === "linux") {
      if ((yield* capture("xdg-open", [url])) === null) yield* capture("gio", ["open", url]);
    }
  });
