import { LockSimpleIcon } from "@blankparticle/ui/icons";
import { Badge } from "@blankparticle/ui/primitives/badge.tsx";

import type { Visibility } from "#/api/spec.ts";

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return visibility === "private" ? (
    <Badge variant="destructive">
      <LockSimpleIcon /> private
    </Badge>
  ) : (
    <Badge variant="secondary">public</Badge>
  );
}
