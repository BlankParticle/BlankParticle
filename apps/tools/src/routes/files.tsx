import { CodeBlock } from "@blankparticle/ui/components/code-block.tsx";
import { ConfirmDialog } from "@blankparticle/ui/components/confirm-dialog.tsx";
import { EmptyState } from "@blankparticle/ui/components/empty-state.tsx";
import { PageHeader } from "@blankparticle/ui/components/page-header.tsx";
import { ArrowSquareOutIcon, FileIcon, FolderIcon, SpinnerGapIcon, TrashIcon } from "@blankparticle/ui/icons";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { Card, CardContent } from "@blankparticle/ui/primitives/card.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@blankparticle/ui/primitives/table.tsx";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { isBundleId, type SharedFile } from "#/api/spec.ts";
import { SignedOut } from "#/components/signed-out.tsx";
import { VisibilityBadge } from "#/components/visibility-badge.tsx";
import { formatBytes, formatTimestamp } from "#/lib/format.ts";
import { filesQuery, meQuery } from "#/lib/queries.ts";
import { removeFile } from "#/lib/server-fns.ts";

export const Route = createFileRoute("/files")({
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me.user) await context.queryClient.ensureQueryData(filesQuery);
  },
  component: FilesPage,
});

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
  const byId = new Map<string, Bundle>();
  for (const file of files) {
    const bundle = byId.get(file.id);
    if (bundle !== undefined) {
      bundle.files.push(file);
      bundle.size += file.size;
      continue;
    }
    // the folder link is the file's URL cut after `/<id>/`
    const url = new URL(file.url);
    url.pathname = url.pathname.slice(0, url.pathname.indexOf(file.id) + file.id.length + 1);
    byId.set(file.id, {
      id: file.id,
      files: [file],
      url: url.toString(),
      size: file.size,
      visibility: file.visibility,
      expiresAt: file.expiresAt,
    });
  }
  return [...byId.values()];
}

function FilesTable({ files }: { files: readonly SharedFile[] }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => removeFile({ data: { id } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: filesQuery.queryKey }),
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
                  className="text-primary inline-flex max-w-80 items-center gap-1.5 truncate font-mono text-sm font-medium hover:underline"
                >
                  {single === undefined && <FolderIcon weight="fill" className="text-orange-deep size-4 shrink-0" />}
                  {single?.name ?? `${bundle.id}/`}
                  <ArrowSquareOutIcon className="text-muted-foreground size-3.5 shrink-0" />
                </a>
                <span className="text-muted-foreground ml-2 hidden font-mono text-xs lg:inline">
                  {single === undefined ? `${bundle.files.length} files` : bundle.id}
                </span>
                {single === undefined && (
                  <ul className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 font-mono text-xs">
                    {bundle.files.map((file) => (
                      <li key={file.name}>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-foreground hover:underline"
                        >
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
  const { data: me } = useSuspenseQuery(meQuery);
  if (!me.user) return <SignedOut denied={me.denied} />;
  return <Files />;
}

function Files() {
  // uploads from the CLI land while this is open; a slow poll picks them up
  const { data: files } = useSuspenseQuery({ ...filesQuery, refetchInterval: 15_000, refetchOnWindowFocus: "always" });
  return (
    <>
      <PageHeader
        title="Files"
        description="Files you have shared from files.blankparticle.com. They disappear after 7 days unless you chose otherwise."
      />
      <Card>
        <CardContent>
          {files.length === 0 ? (
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
            <FilesTable files={files} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
