import { loader as fumaLoader } from "fumadocs-core/source";

import { posts } from "#collections/server.ts";

export const blogSource = fumaLoader({
  baseUrl: "/blog",
  source: posts.toFumadocsSource(),
});
