import type * as React from "react";

import { cn } from "#/lib/utils.ts";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#/primitives/empty.tsx";

/** The `Empty` primitive with a fixed layout: optional icon, title, description, then children */
function EmptyState({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("border border-dashed py-10", className)}>
      <EmptyHeader>
        {icon && (
          <EmptyMedia variant="icon" className="bg-primary/10 text-primary size-11 rounded-xl *:size-5">
            {icon}
          </EmptyMedia>
        )}
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}

export { EmptyState };
