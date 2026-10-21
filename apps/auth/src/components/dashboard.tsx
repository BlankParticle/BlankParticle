import { SpinnerGapIcon } from "@blankparticle/ui/icons";
import { Badge } from "@blankparticle/ui/primitives/badge.tsx";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import type { Dashboard } from "#/lib/server-fns.ts";

/** Loader data of the `_dashboard` layout, which only renders its children when signed in */
export function useDashboard(): Dashboard {
  const dashboard = useLoaderData({ from: "/_dashboard" });
  if (dashboard === null) throw new Error("dashboard pages only render when signed in");
  return dashboard;
}

export const formatTimestamp = (ms: number) => `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;

/** "Chrome on macOS" from a user agent; falls back to the raw string */
export function describeUserAgent(userAgent: string) {
  const browser = /Helium/.test(userAgent)
    ? "Helium"
    : /Edg\//.test(userAgent)
      ? "Edge"
      : /OPR\//.test(userAgent)
        ? "Opera"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Chrome\//.test(userAgent)
            ? "Chrome"
            : /Safari\//.test(userAgent)
              ? "Safari"
              : null;
  const os = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Mac OS X/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;
  if (browser === null && os === null) return userAgent || "Unknown device";
  return [browser, os].filter((part) => part !== null).join(" on ");
}

export function Access({ pii }: { pii: boolean }) {
  return pii ? <Badge variant="secondary">profile</Badge> : <Badge variant="outline">anonymous</Badge>;
}

/** Runs a server fn, then reloads the loader; disables itself meanwhile and says so if it failed */
export function ActionButton({ label, action }: { label: string; action: () => Promise<unknown> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      {failed && <span className="text-destructive text-xs">Failed, try again</span>}
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setFailed(false);
          return action()
            .then(() => router.invalidate())
            .catch(() => setFailed(true))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? <SpinnerGapIcon className="animate-spin" /> : label}
      </Button>
    </span>
  );
}
