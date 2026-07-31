import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import type { AdminAppEnv } from "../alchemy.config.ts";
import { routeTree } from "./routeTree.gen.ts";

export function getRouter() {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

declare module "@tanstack/react-start" {
  interface Register {
    router: ReturnType<typeof getRouter>;
    server: {
      requestContext: {
        cf: {
          env: AdminAppEnv;
          ctx: ExecutionContext;
        };
      };
    };
  }
}
