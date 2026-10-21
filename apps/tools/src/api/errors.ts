import { BadRequest, Forbidden, NotFound } from "./spec.ts";

export const badRequest = (message: string) => new BadRequest({ message });
export const forbidden = (what: "site" | "share") => new Forbidden({ message: `that ${what} belongs to someone else` });
export const noSuchSite = new NotFound({ message: "no such site" });
export const noSuchShare = new NotFound({ message: "no such share" });
export const noSuchFile = new NotFound({ message: "no such file" });
