import { InlineCode } from "@blankparticle/ui/components/code-block.tsx";
import { EmptyState } from "@blankparticle/ui/components/empty-state.tsx";
import { WarningCircleIcon } from "@blankparticle/ui/icons";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { Card, CardContent, CardDescription, CardHeader } from "@blankparticle/ui/primitives/card.tsx";
import { createFileRoute } from "@tanstack/react-router";

import { AppAsking, Person, Receives } from "@/components/authorize.tsx";
import { getConsentRequest } from "@/lib/server-fns.ts";

export const Route = createFileRoute("/consent")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: ({ deps }) => getConsentRequest({ data: { token: deps.token } }),
  component: ConsentPage,
});

function ConsentPage() {
  const request = Route.useLoaderData();
  const { token } = Route.useSearch();
  if (request === null)
    return (
      <EmptyState
        icon={<WarningCircleIcon />}
        title="This sign-in has expired"
        description="Go back to the app and try again."
        className="mt-6"
      />
    );
  return (
    <Card className="mx-auto mt-6 max-w-xl">
      <CardHeader>
        <AppAsking clientId={request.clientId} name={request.name} logo={request.logo} audience={request.audience} />
        <CardDescription className="pt-2">
          {request.audience === request.clientId ? (
            <>It wants to know who you are.</>
          ) : (
            <>
              It wants to sign you in to <InlineCode>{request.audience.replace(/^origin:/, "")}</InlineCode>.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Person user={request.user} />
        <Receives pii={request.pii} user={request.user} />
        <form method="post" action="/consent" className="mt-6 flex gap-3">
          <input type="hidden" name="token" value={token} />
          <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button type="submit" name="decision" value="allow" className="flex-1">
            Allow
          </Button>
        </form>
        <p className="text-muted-foreground mt-3 text-xs">You won't be asked again for this app.</p>
      </CardContent>
    </Card>
  );
}
