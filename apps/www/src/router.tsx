import { createRouter } from "@tanstack/react-router";

import type { WwwAppEnv } from "../alchemy.config.ts";
import { routeTree } from "./routeTree.gen.ts";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
  });
}

declare module "@tanstack/react-start" {
  interface Register {
    router: ReturnType<typeof getRouter>;
    server: {
      requestContext: {
        cf: {
          env: WwwAppEnv;
          ctx: ExecutionContext;
        };
      };
    };
  }
}
