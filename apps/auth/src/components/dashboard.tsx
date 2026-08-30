import { AppWindowIcon, SpinnerGapIcon } from "@blankparticle/ui/icons";
import { Badge } from "@blankparticle/ui/primitives/badge.tsx";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { originOf } from "#/lib/clients.ts";
import type { Dashboard } from "#/lib/server-fns.ts";

/** Loader data of the `_dashboard` layout; children only render when it is non-null */
export const useDashboard = () => useLoaderData({ from: "/_dashboard" }) as NonNullable<Dashboard>;

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

/** Logo + name the app gave us (or its origin), and "→ audience" when it holds a token for another origin */
export function AppIdentity({
  name,
  logo,
  clientId,
  audience,
  size = "sm",
}: {
  name: string | null;
  logo: string | null;
  clientId: string;
  audience: string;
  size?: "sm" | "lg";
}) {
  const client = originOf(clientId);
  const target = originOf(audience);
  const large = size === "lg";
  return (
    <span className="flex min-w-0 items-center gap-3">
      {logo !== null ? (
        <img src={logo} alt="" className={large ? "size-12 rounded-lg" : "size-7 rounded-md"} />
      ) : (
        <span
          className={`bg-muted text-muted-foreground grid shrink-0 place-items-center rounded-md ${large ? "size-12 [&_svg]:size-6" : "size-7 [&_svg]:size-4"}`}
        >
          <AppWindowIcon />
        </span>
      )}
      <span className="min-w-0">
        <span className={`block truncate font-medium ${large ? "font-heading text-lg font-bold" : "text-sm"}`}>
          {name ?? client}
        </span>
        <span className="text-muted-foreground block truncate font-mono text-xs">
          {name !== null && client}
          {target !== client && (
            <>
              {name !== null && " "}→ {target}
            </>
          )}
        </span>
      </span>
    </span>
  );
}

export function Access({ pii }: { pii: boolean }) {
  return pii ? <Badge variant="secondary">profile</Badge> : <Badge variant="outline">anonymous</Badge>;
}

/** Runs a server fn, then reloads the loader; disables itself meanwhile */
export function ActionButton({ label, action }: { label: string; action: () => Promise<unknown> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await action();
          await router.invalidate();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <SpinnerGapIcon className="animate-spin" /> : label}
    </Button>
  );
}
