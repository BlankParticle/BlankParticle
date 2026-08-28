import { cn } from "cnfast";
import type * as React from "react";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-paper placeholder:text-ink-muted/60 selection:bg-orange selection:text-paper flex h-9 w-full min-w-0 rounded-lg border px-3 py-1 text-sm transition-[border-color,box-shadow] outline-none disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-ring/25 focus-visible:ring-3",
        "aria-invalid:border-orange-deep aria-invalid:ring-orange-deep/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
