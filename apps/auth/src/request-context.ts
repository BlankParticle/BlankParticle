import type { AuthAppEnv } from "../alchemy.config.ts";
import type { User } from "./db/schema.ts";

export type Session = { id: string; user: User };

export type AuthRequestContext = {
  cf: {
    env: AuthAppEnv;
    ctx: ExecutionContext;
  };
  /** The broker session behind this request, looked up on first call and memoized */
  session: () => Promise<Session | null>;
};
