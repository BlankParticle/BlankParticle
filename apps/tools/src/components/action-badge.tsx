import { ArrowRightIcon, ProhibitIcon } from "@blankparticle/ui/icons";
import { Badge } from "@blankparticle/ui/primitives/badge.tsx";

import type { RuleAction } from "#/lib/rules.ts";

export function ActionBadge({ action }: { action: RuleAction }) {
  if (action.type === "drop") {
    return (
      <Badge variant="destructive">
        <ProhibitIcon />
        drop
      </Badge>
    );
  }
  return (
    <Badge variant="default">
      <ArrowRightIcon />
      {action.to}
    </Badge>
  );
}
