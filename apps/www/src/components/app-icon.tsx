import { cn } from "@blankparticle/ui/utils";
import type { ComponentProps } from "react";

const sizes = {
  sm: "size-6 rounded-md *:size-4",
  md: "size-9 rounded-lg *:size-6",
};

/** A brand mark on a tinted tile; pass the brand colour as a `bg-*` class */
export function AppIcon({
  size = "sm",
  className,
  children,
  ...props
}: ComponentProps<"span"> & { size?: keyof typeof sizes }) {
  return (
    <span
      className={cn(
        "ring-foreground/10 bg-card relative grid shrink-0 place-items-center overflow-hidden ring-1",
        sizes[size],
        className,
      )}
      aria-hidden="true"
      {...props}
    >
      {children}
    </span>
  );
}
