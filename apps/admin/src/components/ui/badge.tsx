import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cnfast";
import type * as React from "react";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border-2 px-2 py-px text-xs font-bold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-violet text-violet bg-paper",
        secondary: "border-ink bg-lime text-ink",
        outline: "border-ink text-ink bg-paper",
        destructive: "border-orange-deep text-orange-deep bg-paper",
        forward: "border-ink bg-violet text-paper",
        drop: "border-ink bg-orange text-paper",
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
