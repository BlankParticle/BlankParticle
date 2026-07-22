import { posts } from "collections/server.ts";
import { loader as fumaLoader } from "fumadocs-core/source";

export const blogSource = fumaLoader({
  baseUrl: "/blog",
  source: posts.toFumadocsSource(),
});
