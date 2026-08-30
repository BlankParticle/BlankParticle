import { PageHeader } from "@blankparticle/ui/components/page-header.tsx";
import { Badge } from "@blankparticle/ui/primitives/badge.tsx";
import { Card, CardContent } from "@blankparticle/ui/primitives/card.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@blankparticle/ui/primitives/table.tsx";
import { createFileRoute } from "@tanstack/react-router";

import { ActionButton, describeUserAgent, formatTimestamp, useDashboard } from "@/components/dashboard.tsx";
import { revokeBrowserSession } from "@/lib/server-fns.ts";

export const Route = createFileRoute("/_dashboard/devices")({ component: DevicesPage });

function DevicesPage() {
  const { browserSessions, sessionId } = useDashboard();
  return (
    <>
      <PageHeader
        title="Devices"
        description="Browsers where you are signed in. Sign one out and it will have to go through GitHub again."
      />
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead className="hidden sm:table-cell">Signed in</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {browserSessions.map((device) => (
                <TableRow key={device.id}>
                  <TableCell>
                    <span className="inline-flex flex-wrap items-center gap-2" title={device.userAgent}>
                      {describeUserAgent(device.userAgent)}
                      {device.id === sessionId && <Badge variant="secondary">this device</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">
                    {formatTimestamp(device.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <ActionButton label="Sign out" action={() => revokeBrowserSession({ data: { id: device.id } })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
