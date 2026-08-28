import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@blankparticle/ui/components/card.tsx";
import { CodeBlock, InlineCode } from "@blankparticle/ui/components/code-block.tsx";
import { PageHeader } from "@blankparticle/ui/components/page-header.tsx";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cli")({ component: CliPage });

const sections = [
  {
    title: "Setup",
    description: "The CLI lives in the monorepo. Sign in once and it remembers you.",
    lines: [
      "# from the BlankParticle/BlankParticle checkout",
      "vp install && (cd packages/bp && pnpm link --global)",
      "",
      "bp login      # sign in through your browser",
      "bp login --device   # headless: enter a code in any browser",
      "bp whoami     # which GitHub login the service sees",
    ],
  },
  {
    title: "Sites",
    description: "Publish a folder, a single page or a markdown file. Every site gets its own address.",
    lines: [
      "bp site upload ./dist --slug my-site",
      "bp site upload notes.md          # rendered at the site root, raw at /index.md",
      "bp site upload ./site --private  # only signed-in users can view",
      "bp site ls",
      "bp site download my-site ./out  # files as stored, private ones too",
      "bp site rm my-site",
    ],
  },
  {
    title: "Files",
    description: "Share files, or whole folders, with a link. They disappear after 7 days unless you say otherwise.",
    lines: [
      "bp file upload report.pdf",
      "bp file upload ./branding         # a folder: every file under one id, paths kept",
      'bp file upload build.zip -e "12 hours"   # or 3d, 30m, never',
      "bp file upload notes.txt --private",
      "bp file ls",
      "bp file download <id> ./out       # a file, or a whole bundle",
      "bp file rm <id>                   # removes everything under that id",
    ],
  },
  {
    title: "Repos",
    description: "Clone into ~/Projects/<owner>/<repo> (override with $BP_PROJECTS).",
    lines: ["bp clone owner/repo", "bp clone https://github.com/owner/repo"],
  },
] as const;

function CliPage() {
  return (
    <>
      <PageHeader
        title="CLI"
        description={
          <>
            Everything here is driven by <InlineCode>bp</InlineCode>. Each site gets its own origin, so pages work
            exactly as they would on any static host.
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock lines={section.lines} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
