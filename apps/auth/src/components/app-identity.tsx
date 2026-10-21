import { AppWindowIcon } from "@blankparticle/ui/icons";

import { originOf } from "#/lib/clients.ts";

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
