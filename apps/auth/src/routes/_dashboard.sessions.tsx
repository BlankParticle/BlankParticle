import { EmptyState } from "@blankparticle/ui/components/empty-state.tsx";
import { PageHeader } from "@blankparticle/ui/components/page-header.tsx";
import { KeyIcon } from "@blankparticle/ui/icons";
import { Card, CardContent } from "@blankparticle/ui/primitives/card.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@blankparticle/ui/primitives/table.tsx";
import { createFileRoute } from "@tanstack/react-router";

import { Access, ActionButton, AppIdentity, formatTimestamp, useDashboard } from "@/components/dashboard.tsx";
import { revokeToken } from "@/lib/server-fns.ts";

export const Route = createFileRoute("/_dashboard/sessions")({ component: SessionsPage });

function SessionsPage() {
  const { tokens } = useDashboard();
  return (
    <>
      <PageHeader
        title="Sessions"
        description="Where you are signed in right now. Revoke one to sign that app out; it will need to sign in again."
      />
      {tokens.length === 0 ? (
        <EmptyState
          icon={<KeyIcon />}
          title="Not signed in anywhere"
          description="When an app signs you in, it shows up here."
        />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead className="hidden sm:table-cell">Issued</TableHead>
                  <TableHead className="hidden md:table-cell">Expires</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.jti}>
                    <TableCell>
                      <AppIdentity
                        name={token.clientName}
                        logo={token.clientLogo}
                        clientId={token.clientId}
                        audience={token.audience}
                      />
                    </TableCell>
                    <TableCell>
                      <Access pii={token.pii} />
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">
                      {formatTimestamp(token.issuedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                      {formatTimestamp(token.expiresAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionButton label="Revoke" action={() => revokeToken({ data: { id: token.jti } })} />
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
