import { GithubLogoIcon } from "@blankparticle/ui/icons";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@blankparticle/ui/primitives/card.tsx";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

import { getDashboard } from "@/lib/server-fns.ts";

/** Pathless layout: loads the account once for every dashboard page, or shows the sign-in card */
export const Route = createFileRoute("/_dashboard")({ loader: () => getDashboard(), component: DashboardLayout });

function DashboardLayout() {
  const dashboard = Route.useLoaderData();
  if (dashboard === null) return <SignIn />;
  return <Outlet />;
}

function SignIn() {
  const returnTo = useRouterState({ select: (state) => state.location.href });
  return (
    <Card className="mx-auto mt-6 max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>One sign-in for everything BlankParticle, using your GitHub account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          size="lg"
          className="w-full"
          nativeButton={false}
          render={<a href={`/login?return_to=${encodeURIComponent(returnTo)}`} />}
        >
          <GithubLogoIcon weight="bold" /> Continue with GitHub
        </Button>
      </CardContent>
    </Card>
  );
}
