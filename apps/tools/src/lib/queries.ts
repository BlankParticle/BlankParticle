import { queryOptions } from "@tanstack/react-query";

import { getEmailConfig } from "./email-api.ts";
import { getDashboard } from "./server-fns.ts";

export const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: ({ signal }) => getDashboard({ signal }),
});

export const emailConfigQuery = queryOptions({
  queryKey: ["email-config"],
  queryFn: ({ signal }) => getEmailConfig({ signal }),
});
