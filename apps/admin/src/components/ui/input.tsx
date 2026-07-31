import { cn } from "cnfast";
import type * as React from "react";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-ink bg-paper placeholder:text-ink-muted/60 selection:bg-orange selection:text-paper flex h-9 w-full min-w-0 rounded-lg border-2 px-3 py-1 text-sm transition-shadow outline-none disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:shadow-[3px_3px_0_var(--color-orange)]",
        "aria-invalid:border-orange-deep",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
