import { cn } from "cnfast";
import type * as React from "react";

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
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <div className="bg-muted text-ink-muted mb-2 grid size-12 place-items-center rounded-full [&_svg]:size-6">
          {icon}
        </div>
      )}
      <p className="font-heading text-lg font-bold tracking-tight">{title}</p>
      {description && <p className="text-muted-foreground max-w-sm text-sm text-pretty">{description}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

export { EmptyState };
