import { CheckIcon, CopyIcon } from "@blankparticle/ui/icons";
import { Button } from "@blankparticle/ui/primitives/button.tsx";
import { useState } from "react";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="outline"
      size="icon"
      className="ml-auto shrink-0"
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
      {copied ? <CheckIcon className="text-primary" weight="bold" /> : <CopyIcon />}
    </Button>
  );
}
