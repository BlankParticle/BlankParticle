import { Badge } from "@blankparticle/ui/components/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@blankparticle/ui/components/card.tsx";
import { ArrowRightIcon, GlobeIcon } from "@blankparticle/ui/icons";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import type { EmailRoutingSettings } from "@/lib/api.ts";
import { zonesQuery } from "@/lib/queries.ts";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(zonesQuery),
  component: Overview,
});

function routingBadge(routing: EmailRoutingSettings) {
  if ("error" in routing) return <Badge variant="destructive">{routing.error}</Badge>;
  if (!routing.enabled) return <Badge variant="destructive">routing off</Badge>;
  if (routing.status === "ready") return <Badge variant="secondary">routing ready</Badge>;
  return <Badge variant="outline">{routing.status}</Badge>;
}

function Overview() {
  const { data: zones } = useSuspenseQuery(zonesQuery);

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">Zones</h1>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {zones.map((zone) => (
          <Card key={zone.id} className="group">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GlobeIcon className="text-orange-deep size-4.5" />
                {zone.name}
              </CardTitle>
              <div className="flex flex-wrap gap-1.5 pt-2">
                <Badge variant={zone.status === "active" ? "secondary" : "outline"}>{zone.status}</Badge>
                {routingBadge(zone.routing)}
              </div>
            </CardHeader>
            <CardContent>
              <Link
                to="/email"
                hash={zone.name}
                className="text-violet decoration-orange inline-flex items-center gap-1 text-sm font-bold decoration-wavy decoration-2 underline-offset-4 hover:underline"
              >
                manage rules <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
