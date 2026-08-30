import type * as React from "react";

import { cn } from "#/lib/utils.ts";

/** Terminal-style block for CLI snippets; lines starting with `#` render muted */
function CodeBlock({ lines, className }: { lines: readonly string[]; className?: string }) {
  return (
    <pre
      className={cn(
        "bg-code text-code-foreground scrollbar-light overflow-x-auto rounded-lg px-4 py-3.5 font-mono text-sm leading-relaxed",
        className,
      )}
    >
      {lines.map((line, index) => (
        <span key={index} className={cn("block", line.startsWith("#") && "text-code-foreground/50")}>
          {line || " "}
        </span>
      ))}
    </pre>
  );
}

function InlineCode({ className, ...props }: React.ComponentProps<"code">) {
  return (
    <code
      className={cn("bg-muted rounded-md border px-1.5 py-0.5 font-mono text-sm whitespace-nowrap", className)}
      {...props}
    />
  );
}

export { CodeBlock, InlineCode };
