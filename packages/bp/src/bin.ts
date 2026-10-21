#!/usr/bin/env node
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Command from "effect/cli/Command";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import packageJson from "../package.json" with { type: "json" };
import { bp } from "./cli.ts";
import { fail } from "./runtime.ts";

NodeRuntime.runMain(
  Command.run(bp, { version: packageJson.version }).pipe(
    // filesystem failures (unreadable source, unwritable destination…) are something the user can fix too
    Effect.catchTag("PlatformError", (error) => fail(error.message)),
    // the tools API refused (its message says why), or couldn't be asked
    Effect.catchTags({
      BadRequest: (error) => fail(error.message),
      Unauthorized: (error) => fail(`${error.message}: run \`bp login\``),
      Forbidden: (error) => fail(error.message),
      NotFound: (error) => fail(error.message),
      HttpClientError: (error) =>
        fail(
          error.reason._tag === "TransportError"
            ? `could not reach the server: ${error.message}`
            : `unexpected response from the server: ${error.message}`,
        ),
      SchemaError: (error) => fail(`invalid API data: ${error.message}`),
    }),
    // expected failures (expired login, not allow-listed, wrong slug…) are one line, no stack
    Effect.catchTag("UserError", (error) =>
      Console.error(`✖ ${error.message}`).pipe(Effect.andThen(Effect.sync(() => process.exit(1)))),
    ),
    Effect.provide(Layer.mergeAll(NodeServices.layer, NodeHttpClient.layerUndici)),
  ),
);
