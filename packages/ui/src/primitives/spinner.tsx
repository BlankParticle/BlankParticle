import { SpinnerGapIcon, type IconProps } from "#/lib/icons.ts";
import { cn } from "#/lib/utils.ts";

function Spinner({ className, ...props }: IconProps) {
  return (
    <SpinnerGapIcon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
