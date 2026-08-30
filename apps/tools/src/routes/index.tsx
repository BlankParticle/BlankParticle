import { CodeBlock } from "@blankparticle/ui/components/code-block.tsx";
import { ConfirmDialog } from "@blankparticle/ui/components/confirm-dialog.tsx";
import { EmptyState } from "@blankparticle/ui/components/empty-state.tsx";
import { PageHeader } from "@blankparticle/ui/components/page-header.tsx";
import { ArrowSquareOutIcon, GlobeIcon, LockSimpleIcon, SpinnerGapIcon, TrashIcon } from "@blankparticle/ui/icons";
import { Badge } from "@blankparticle/ui/primitives/badge.tsx";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { Card, CardContent } from "@blankparticle/ui/primitives/card.tsx";
import { Switch } from "@blankparticle/ui/primitives/switch.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@blankparticle/ui/primitives/table.tsx";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import type { Site } from "@/api/spec.ts";
import { formatTimestamp, SignedOut } from "@/components/signed-out.tsx";
import { dashboardQuery } from "@/lib/queries.ts";
import { removeSite, setSiteVisibility } from "@/lib/server-fns.ts";

export const Route = createFileRoute("/")({ component: SitesPage });

export function VisibilityBadge({ visibility }: { visibility: "public" | "private" }) {
  return visibility === "private" ? (
    <Badge variant="destructive">
      <LockSimpleIcon /> private
    </Badge>
  ) : (
    <Badge variant="secondary">public</Badge>
  );
}

function SitesTable({ sites }: { sites: readonly Site[] }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: dashboardQuery.queryKey });

  const visibility = useMutation({
    mutationFn: (site: Site) =>
      setSiteVisibility({ data: { slug: site.slug, visibility: site.visibility === "public" ? "private" : "public" } }),
    onSettled: invalidate,
  });
  const remove = useMutation({ mutationFn: (slug: string) => removeSite({ data: { slug } }), onSettled: invalidate });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Site</TableHead>
          <TableHead>Visibility</TableHead>
          <TableHead className="hidden md:table-cell">Updated</TableHead>
          <TableHead className="text-right">Private</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sites.map((site) => {
          const busy =
            (visibility.isPending && visibility.variables.slug === site.slug) ||
            (remove.isPending && remove.variables === site.slug);
          return (
            <TableRow key={site.slug} className={busy ? "opacity-60" : ""}>
              <TableCell>
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1.5 font-mono text-sm font-medium hover:underline"
                >
                  {new URL(site.url).host}
                  <ArrowSquareOutIcon className="text-muted-foreground size-3.5" />
                </a>
              </TableCell>
              <TableCell>
                <VisibilityBadge visibility={site.visibility} />
              </TableCell>
              <TableCell className="text-muted-foreground hidden font-mono text-xs md:table-cell">
                {formatTimestamp(site.updatedAt)}
              </TableCell>
              <TableCell className="text-right">
                <Switch
                  checked={site.visibility === "private"}
                  onCheckedChange={() => visibility.mutate(site)}
                  disabled={busy}
                />
              </TableCell>
              <TableCell className="w-8 text-right">
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={busy}
                    >
                      {remove.isPending && remove.variables === site.slug ? (
                        <SpinnerGapIcon className="animate-spin" />
                      ) : (
                        <TrashIcon />
                      )}
                      <span className="sr-only">Delete site</span>
                    </Button>
                  }
                  title={`Delete ${site.slug}?`}
                  description="The site and all its files are removed. Its links stop working within a minute."
                  onConfirm={() => remove.mutateAsync(site.slug)}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function SitesPage() {
  const { data } = useSuspenseQuery(dashboardQuery);
  if (!data.user) return <SignedOut denied={data.denied} />;

  return (
    <>
      <PageHeader
        title="Sites"
        description="Pages and notes you have published. Public sites open for anyone with the link; private ones only for you."
      />
      <Card>
        <CardContent>
          {data.sites.length === 0 ? (
            <EmptyState
              icon={<GlobeIcon />}
              title="No sites yet"
              description="Publish a folder, a page or a markdown file with the CLI and it will show up here."
            >
              <CodeBlock lines={["bp site upload ./dist --slug my-site"]} className="text-left" />
            </EmptyState>
          ) : (
            <SitesTable sites={data.sites} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
