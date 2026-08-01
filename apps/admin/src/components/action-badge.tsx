import { Badge } from "@blankparticle/ui/components/badge.tsx";
import { ArrowRightIcon, ProhibitIcon } from "@blankparticle/ui/icons";

import type { RuleAction } from "@/lib/rules.ts";

export function ActionBadge({ action }: { action: RuleAction }) {
  if (action.type === "drop") {
    return (
      <Badge variant="drop">
        <ProhibitIcon />
        drop
      </Badge>
    );
  }
  return (
    <Badge variant="forward">
      <ArrowRightIcon />
      {action.to}
    </Badge>
  );
}
