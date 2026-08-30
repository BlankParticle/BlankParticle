import type * as React from "react";

import { cn } from "#/lib/utils.ts";

function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="flex flex-col gap-1.5">
        {eyebrow && <p className="eyebrow text-orange-deep">{eyebrow}</p>}
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        {description && <p className="text-muted-foreground max-w-prose text-sm text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export { PageHeader };
