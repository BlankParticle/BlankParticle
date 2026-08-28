#!/usr/bin/env node
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Command from "effect/unstable/cli/Command";

import { bp } from "./cli.ts";

NodeRuntime.runMain(
  Command.run(bp, { version: "0.1.0" }).pipe(
    // expected failures (expired login, not allow-listed, wrong slug…) are one line, no stack
    Effect.catchTag("UserError", (error) =>
      Console.error(`✖ ${error.message}`).pipe(Effect.andThen(Effect.sync(() => process.exit(1)))),
    ),
    Effect.provide(Layer.mergeAll(NodeServices.layer, NodeHttpClient.layerUndici)),
  ),
);
