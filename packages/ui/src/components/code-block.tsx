import { cn } from "cnfast";
import type * as React from "react";

/** Terminal-style block for CLI snippets; lines starting with `#` render muted */
function CodeBlock({ lines, className }: { lines: readonly string[]; className?: string }) {
  return (
    <pre
      className={cn(
        "bg-ink text-paper [--scrollbar-thumb:color-mix(in_oklch,var(--color-paper)_30%,transparent)] overflow-x-auto rounded-lg px-4 py-3.5 font-mono text-[13px] leading-relaxed",
        className,
      )}
    >
      {lines.map((line, index) => (
        <span key={index} className={cn("block", line.startsWith("#") && "text-paper/50")}>
          {line || " "}
        </span>
      ))}
    </pre>
  );
}

function InlineCode({ className, ...props }: React.ComponentProps<"code">) {
  return <code className={cn("bg-muted rounded px-1.5 py-0.5 font-mono text-[0.85em]", className)} {...props} />;
}

export { CodeBlock, InlineCode };
