import { Button } from "@blankparticle/ui/components/button.tsx";
import { CheckIcon, CopyIcon } from "@blankparticle/ui/icons";
import { useState, type PropsWithChildren } from "react";

export function CopyButton({ value, label }: PropsWithChildren<{ value: string; label: string }>) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="violet"
      size="icon-lg"
      className="ml-auto shrink-0 rounded-md"
      aria-label={label}
      aria-live="polite"
      onClick={() =>
        navigator.clipboard
          .writeText(value)
          .then(() => setCopied(true))
          .catch(() => setCopied(false))
          .finally(() => setTimeout(() => setCopied(false), 2000))
      }
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
