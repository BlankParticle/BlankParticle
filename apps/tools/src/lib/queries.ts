import { queryOptions } from "@tanstack/react-query";

import { getEmailConfig } from "./email-api.ts";
import { getFiles, getMe, getSites } from "./server-fns.ts";

/** Who is signed in; every page needs it, so it carries nothing else */
export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: ({ signal }) => getMe({ signal }),
});

export const sitesQuery = queryOptions({
  queryKey: ["sites"],
  queryFn: ({ signal }) => getSites({ signal }),
});

export const filesQuery = queryOptions({
  queryKey: ["files"],
  queryFn: ({ signal }) => getFiles({ signal }),
});

export const emailConfigQuery = queryOptions({
  queryKey: ["email-config"],
  queryFn: ({ signal }) => getEmailConfig({ signal }),
});
