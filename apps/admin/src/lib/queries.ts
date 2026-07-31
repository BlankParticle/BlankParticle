import { queryOptions } from "@tanstack/react-query";

import { getEmailConfig, getZonesOverview } from "./api.ts";

export const zonesQuery = queryOptions({
  queryKey: ["zones"],
  queryFn: ({ signal }) => getZonesOverview({ signal }),
});

export const emailConfigQuery = queryOptions({
  queryKey: ["email-config"],
  queryFn: ({ signal }) => getEmailConfig({ signal }),
});
