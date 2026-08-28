import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cnfast";
import type * as React from "react";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border px-2 py-px text-xs font-semibold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-violet/30 bg-violet/10 text-violet",
        secondary: "border-lime bg-lime/60 text-ink",
        outline: "border-input bg-paper text-ink",
        destructive: "border-orange-deep/30 bg-orange-deep/10 text-orange-deep",
        forward: "border-violet/30 bg-violet/10 text-violet",
        drop: "border-orange-deep/30 bg-orange-deep/10 text-orange-deep",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
