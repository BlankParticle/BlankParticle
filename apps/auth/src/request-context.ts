import type { AuthAppEnv } from "../alchemy.config.ts";
import type { User } from "./db/schema.ts";

export type AuthRequestContext = {
  cf: {
    env: AuthAppEnv;
    ctx: ExecutionContext;
  };
  session: { id: string; user: User } | null;
};
