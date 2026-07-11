import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen.ts";
import type { CloudflareEnv } from "./worker.ts";

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
          env: CloudflareEnv;
          ctx: ExecutionContext;
        };
      };
    };
  }
}
