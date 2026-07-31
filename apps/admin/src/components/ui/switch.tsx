import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "cnfast";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer border-ink data-checked:bg-violet data-unchecked:bg-muted focus-visible:ring-ring/50 inline-flex h-5.5 w-9.5 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="border-ink bg-paper pointer-events-none block size-4 rounded-full border-2 transition-transform data-checked:translate-x-4 data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
