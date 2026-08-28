import { Button } from "@blankparticle/ui/components/button.tsx";
import { Card, CardContent } from "@blankparticle/ui/components/card.tsx";
import { CodeBlock } from "@blankparticle/ui/components/code-block.tsx";
import { ConfirmDialog } from "@blankparticle/ui/components/confirm-dialog.tsx";
import { EmptyState } from "@blankparticle/ui/components/empty-state.tsx";
import { PageHeader } from "@blankparticle/ui/components/page-header.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@blankparticle/ui/components/table.tsx";
import { ArrowSquareOutIcon, FileIcon, FolderIcon, SpinnerGapIcon, TrashIcon } from "@blankparticle/ui/icons";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { isBundleId, type SharedFile } from "@/api/spec.ts";
import { formatBytes, formatTimestamp, SignedOut } from "@/components/signed-out.tsx";
import { dashboardQuery } from "@/lib/queries.ts";
import { removeFile } from "@/lib/server-fns.ts";

import { VisibilityBadge } from "./index.tsx";

export const Route = createFileRoute("/files")({ component: FilesPage });

/** A drop is every file sharing an id; a multi-file drop is shown as a folder with its `/<id>/` listing link */
type Bundle = {
  id: string;
  files: SharedFile[];
  url: string;
  size: number;
  visibility: SharedFile["visibility"];
  expiresAt: number | null;
};

function bundlesOf(files: readonly SharedFile[]): Bundle[] {
  const byId = new Map<string, SharedFile[]>();
  for (const file of files) byId.set(file.id, [...(byId.get(file.id) ?? []), file]);
  return [...byId.entries()].map(([id, members]) => {
    const first = members[0]!;
    const url = new URL(first.url);
    url.pathname = url.pathname.slice(0, url.pathname.indexOf(id) + id.length + 1);
    return {
      id,
      files: members,
      url: url.toString(),
      size: members.reduce((sum, file) => sum + file.size, 0),
      visibility: first.visibility,
      expiresAt: first.expiresAt,
    };
  });
}

function FilesTable({ files }: { files: readonly SharedFile[] }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => removeFile({ data: { id } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: dashboardQuery.queryKey }),
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          <TableHead>Visibility</TableHead>
          <TableHead className="text-right">Size</TableHead>
          <TableHead className="hidden md:table-cell">Expires</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {bundlesOf(files).map((bundle) => {
          const busy = remove.isPending && remove.variables === bundle.id;
          const single = isBundleId(bundle.id) ? undefined : bundle.files[0];
          return (
            <TableRow key={bundle.id} className={busy ? "opacity-60" : ""}>
              <TableCell className="whitespace-normal">
                <a
                  href={single?.url ?? bundle.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet inline-flex max-w-80 items-center gap-1.5 truncate font-mono text-sm font-medium hover:underline"
                >
                  {single === undefined && <FolderIcon weight="fill" className="text-orange-deep size-4 shrink-0" />}
                  {single?.name ?? `${bundle.id}/`}
                  <ArrowSquareOutIcon className="text-ink-muted size-3.5 shrink-0" />
                </a>
                <span className="text-ink-muted ml-2 hidden font-mono text-xs lg:inline">
                  {single === undefined ? `${bundle.files.length} files` : bundle.id}
                </span>
                {single === undefined && (
                  <ul className="text-ink-muted mt-1 flex flex-wrap gap-x-3 font-mono text-xs">
                    {bundle.files.map((file) => (
                      <li key={file.name}>
                        <a href={file.url} target="_blank" rel="noreferrer" className="hover:text-ink hover:underline">
                          {file.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </TableCell>
              <TableCell>
                <VisibilityBadge visibility={bundle.visibility} />
              </TableCell>
              <TableCell className="text-right font-mono text-xs">{formatBytes(bundle.size)}</TableCell>
              <TableCell className="text-muted-foreground hidden font-mono text-xs md:table-cell">
                {bundle.expiresAt === null ? "never" : formatTimestamp(bundle.expiresAt)}
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
                      {busy ? <SpinnerGapIcon className="animate-spin" /> : <TrashIcon />}
                      <span className="sr-only">Delete</span>
                    </Button>
                  }
                  title={
                    single === undefined
                      ? `Delete ${bundle.files.length} files under ${bundle.id}/?`
                      : `Delete ${single.name}?`
                  }
                  description="Its links stop working right away."
                  onConfirm={() => remove.mutateAsync(bundle.id)}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function FilesPage() {
  const { data } = useSuspenseQuery({
    ...dashboardQuery,
    refetchInterval: 3_000,
    refetchOnWindowFocus: "always",
  });
  if (!data.user) return <SignedOut denied={data.denied} />;

  return (
    <>
      <PageHeader
        title="Files"
        description="Files you have shared from files.blankparticle.com. They disappear after 7 days unless you chose otherwise."
      />
      <Card>
        <CardContent>
          {data.files.length === 0 ? (
            <EmptyState
              icon={<FileIcon />}
              title="No files yet"
              description="Upload something with the CLI and it will show up here with a link to share."
            >
              <CodeBlock
                lines={["bp file upload report.pdf -e 3d", "bp file upload ./branding   # a folder"]}
                className="text-left"
              />
            </EmptyState>
          ) : (
            <FilesTable files={data.files} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
