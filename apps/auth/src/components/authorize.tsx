import { InlineCode } from "@blankparticle/ui/components/code-block.tsx";

import { AppIdentity } from "@/components/dashboard.tsx";
import type { User } from "@/db/schema.ts";

/** The app asking, as it introduced itself, and what it is asking for */
export function AppAsking({
  clientId,
  name,
  logo,
  audience,
}: {
  clientId: string;
  name: string | null;
  logo: string | null;
  audience: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <AppIdentity name={name} logo={logo} clientId={clientId} audience={audience} size="lg" />
    </div>
  );
}

/** Who is signing in */
export function Person({ user }: { user: Pick<User, "login" | "name" | "picture"> }) {
  return (
    <div className="bg-muted flex items-center gap-3 rounded-lg p-3">
      <img src={user.picture} alt="" className="size-12 rounded-full" />
      <div className="min-w-0">
        <p className="truncate font-bold">{user.name ?? user.login}</p>
        <p className="text-ink-muted truncate text-sm">@{user.login}</p>
      </div>
    </div>
  );
}

/** Exactly which claims the app will get */
export function Receives({ pii, user }: { pii: boolean; user: Pick<User, "login" | "name" | "email"> }) {
  return (
    <>
      <p className="text-ink-muted mt-4 text-sm">It will get:</p>
      <ul className="mt-1 list-disc pl-5 text-sm">
        {pii ? (
          <>
            <li>
              your GitHub username <InlineCode>{user.login}</InlineCode>
            </li>
            {user.name !== null && (
              <li>
                your name <InlineCode>{user.name}</InlineCode>
              </li>
            )}
            <li>your profile picture</li>
            {user.email !== null && (
              <li>
                your email address <InlineCode>{user.email}</InlineCode>
              </li>
            )}
          </>
        ) : (
          <li>a random ID that only this app knows you by — no name, username or email</li>
        )}
      </ul>
    </>
  );
}
