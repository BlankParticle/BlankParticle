import { Button } from "@blankparticle/ui/components/button.tsx";
import { EmptyState } from "@blankparticle/ui/components/empty-state.tsx";
import { FingerprintIcon, LockSimpleIcon, ProhibitIcon } from "@blankparticle/ui/icons";
import { useRouterState } from "@tanstack/react-router";

/** Shown when there is no valid id_token, or (`denied`) when the signed-in GitHub email is not the owner's */
export function SignedOut({ denied }: { denied?: string | null }) {
  if (denied)
    return (
      <EmptyState
        icon={<ProhibitIcon />}
        title="This account can't use tools"
        description={`You are signed in as ${denied}, but tools is only for its owner.`}
        className="mt-6"
      >
        <form method="post" action="/auth/logout">
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </EmptyState>
    );
  return (
    <EmptyState
      icon={<LockSimpleIcon />}
      title="Not signed in"
      description="Sign in to manage your sites, files and email."
      className="mt-6"
    >
      <SignInButton />
    </EmptyState>
  );
}

/** Starts the PKCE flow at the worker's `/auth/login`, which brings you back to the current page */
function SignInButton() {
  const returnTo = useRouterState({ select: (state) => state.location.href });
  const href = `/auth/login?return_to=${encodeURIComponent(returnTo)}`;
  return (
    <Button variant="violet" nativeButton={false} render={<a href={href} />}>
      <FingerprintIcon weight="bold" /> Sign in with BlankParticle Auth
    </Button>
  );
}

export function formatTimestamp(ts: number) {
  return `${new Date(ts).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
