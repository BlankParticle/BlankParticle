import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "violet" | "orange" | "violet-outline";

type Props = {
  children: ReactNode;
  variant?: Variant;
  href?: string;
} & AnchorHTMLAttributes<HTMLAnchorElement> &
  ButtonHTMLAttributes<HTMLButtonElement>;

const base =
  "rounded-md border-2 px-5 py-2.5 font-bold transition-transform duration-150 ease-out hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none";

const variants: Record<Variant, string> = {
  violet:
    "border-ink bg-violet text-paper shadow-[4px_4px_0_var(--color-ink)] hover:shadow-[2px_2px_0_var(--color-ink)]",
  orange:
    "border-orange-deep bg-paper text-orange-deep shadow-[4px_4px_0_var(--color-orange)] hover:shadow-[2px_2px_0_var(--color-orange)]",
  "violet-outline":
    "border-violet bg-paper text-violet shadow-[4px_4px_0_var(--color-violet)] hover:shadow-[2px_2px_0_var(--color-violet)]",
};

export default function PushButton({ children, variant = "violet", href, className = "", ...rest }: Props) {
  const classes = `${base} ${variants[variant]} ${className}`;

  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={`cursor-pointer ${classes}`} {...rest}>
      {children}
    </button>
  );
}
