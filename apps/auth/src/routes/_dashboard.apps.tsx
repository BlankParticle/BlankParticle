import { EmptyState } from "@blankparticle/ui/components/empty-state.tsx";
import { PageHeader } from "@blankparticle/ui/components/page-header.tsx";
import { AppWindowIcon } from "@blankparticle/ui/icons";
import { Card, CardContent } from "@blankparticle/ui/primitives/card.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@blankparticle/ui/primitives/table.tsx";
import { createFileRoute } from "@tanstack/react-router";

import { Access, ActionButton, AppIdentity, formatTimestamp, useDashboard } from "#/components/dashboard.tsx";
import { removeApp } from "#/lib/server-fns.ts";

export const Route = createFileRoute("/_dashboard/apps")({ component: AppsPage });

function AppsPage() {
  const { apps } = useDashboard();
  return (
    <>
      <PageHeader
        title="Apps"
        description="Apps you have let sign you in. Remove one and it will ask for your permission again next time."
      />
      {apps.length === 0 ? (
        <EmptyState
          icon={<AppWindowIcon />}
          title="No apps yet"
          description="Sign in to something and it will show up here."
        />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead className="hidden sm:table-cell">Authorized</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <AppIdentity name={app.name} logo={app.logo} clientId={app.clientId} audience={app.audience} />
                    </TableCell>
                    <TableCell>
                      <Access pii={app.pii} />
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">
                      {formatTimestamp(app.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionButton label="Remove" action={() => removeApp({ data: { id: app.id } })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
