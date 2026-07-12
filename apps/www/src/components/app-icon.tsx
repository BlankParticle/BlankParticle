import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function AppIcon({ className, children, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "relative grid size-5 shrink-0 place-items-center overflow-hidden rounded-[27%] shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_0_0_1px_rgba(0,0,0,0.15)] [&_svg]:size-3!",
        "bg-paper",
        className,
      )}
      aria-hidden="true"
      {...props}
    >
      {children}
    </span>
  );
}
