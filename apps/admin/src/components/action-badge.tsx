import { ArrowRightIcon, BanIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge.tsx";
import type { RuleAction } from "@/lib/rules.ts";

export function ActionBadge({ action }: { action: RuleAction }) {
  if (action.type === "drop") {
    return (
      <Badge variant="drop">
        <BanIcon />
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
