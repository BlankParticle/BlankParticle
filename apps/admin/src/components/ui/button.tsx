import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cnfast";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-ink bg-violet text-paper rounded-lg border-2 font-bold shadow-[3px_3px_0_var(--color-ink)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_var(--color-ink)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        outline:
          "border-violet bg-paper text-violet rounded-lg border-2 font-bold shadow-[3px_3px_0_var(--color-violet)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_var(--color-violet)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        secondary:
          "border-ink bg-lime text-ink rounded-full border-2 font-bold hover:-translate-y-0.5 active:translate-y-0",
        ghost: "text-ink-muted hover:bg-muted hover:text-ink rounded-lg border-2 border-transparent",
        destructive:
          "border-orange-deep bg-paper text-orange-deep rounded-lg border-2 font-bold shadow-[3px_3px_0_var(--color-orange)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_var(--color-orange)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        link: "text-violet font-bold underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-3.5 text-sm",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-2.5 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-5 text-base",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    compoundVariants: [
      {
        // stable hit area: the button translates on hover/active, so extend the
        // pointer target past the movement range to avoid hover flicker at the edges
        variant: ["default", "outline", "destructive"],
        class: "relative before:absolute before:-inset-1",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
