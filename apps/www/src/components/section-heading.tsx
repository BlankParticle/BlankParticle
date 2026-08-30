import type { ReactNode } from "react";

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="font-heading pb-4 text-3xl font-bold sm:text-4xl">{children}</h2>;
}
