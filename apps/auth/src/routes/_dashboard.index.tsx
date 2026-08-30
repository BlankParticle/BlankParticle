import { ConfirmDialog } from "@blankparticle/ui/components/confirm-dialog.tsx";
import { PageHeader } from "@blankparticle/ui/components/page-header.tsx";
import { SealCheckIcon, SignOutIcon } from "@blankparticle/ui/icons";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@blankparticle/ui/primitives/card.tsx";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";

import { useDashboard } from "@/components/dashboard.tsx";
import { signOutEverywhere } from "@/lib/server-fns.ts";

export const Route = createFileRoute("/_dashboard/")({ component: ProfilePage });

function ProfilePage() {
  const { user, apps, tokens, browserSessions } = useDashboard();
  const router = useRouter();
  const stats = [
    { to: "/apps", label: "Apps", value: apps.length },
    { to: "/sessions", label: "Sessions", value: tokens.length },
    { to: "/devices", label: "Devices", value: browserSessions.length },
  ] as const;
  return (
    <>
      <PageHeader title="Profile" description="This is what an app learns about you when you let it see who you are." />
      <div className="flex flex-col gap-5">
        <Card>
          <CardContent className="flex items-center gap-4">
            <img src={user.picture} alt="" className="size-16 rounded-full" />
            <div className="min-w-0">
              <p className="font-heading truncate text-lg font-bold">{user.name ?? user.login}</p>
              <p className="text-muted-foreground truncate text-sm">@{user.login}</p>
              {user.email !== null && (
                <p className="text-muted-foreground inline-flex items-center gap-1 text-sm">
                  {user.email}
                  {user.emailVerified && <SealCheckIcon weight="fill" className="text-primary size-4" />}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <Link key={stat.to} to={stat.to} className="group">
              <Card className="group-hover:ring-foreground/20 transition-colors">
                <CardContent>
                  <p className="text-muted-foreground text-sm">{stat.label}</p>
                  <p className="font-heading text-3xl font-bold">{stat.value}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign out</CardTitle>
            <CardDescription>Sign out of this browser only, or out of everything at once.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <form method="post" action="/logout">
              <Button type="submit" variant="outline">
                <SignOutIcon /> Sign out
              </Button>
            </form>
            <ConfirmDialog
              trigger={<Button variant="destructive">Sign out everywhere</Button>}
              title="Sign out everywhere?"
              description="Every browser and every app is signed out. You will have to sign in again wherever you use them."
              confirmLabel="Sign out everywhere"
              onConfirm={async () => {
                await signOutEverywhere();
                await router.invalidate();
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
