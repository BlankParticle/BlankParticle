import { EmptyState } from "@blankparticle/ui/components/empty-state.tsx";
import { WarningCircleIcon } from "@blankparticle/ui/icons";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/error")({
  validateSearch: (search: Record<string, unknown>) => ({
    title: typeof search.title === "string" ? search.title : "Something went wrong",
    message: typeof search.message === "string" ? search.message : "",
  }),
  component: ErrorPage,
});

function ErrorPage() {
  const { title, message } = Route.useSearch();
  return (
    <EmptyState
      icon={<WarningCircleIcon />}
      title={title}
      description={message || "You can close this tab and try signing in again."}
      className="mt-6"
    />
  );
}
