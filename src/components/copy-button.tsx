import { useState } from "react";

import Confirm from "../icons/confirm";
import Copy from "../icons/copy";
import { copyText } from "../lib/clipboard";

interface Props {
  value: string;
  label: string;
}

export default function CopyButton({ value, label }: Props) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="border-ink bg-violet text-paper ml-auto grid size-9 shrink-0 cursor-pointer place-items-center rounded-md border-2 shadow-[3px_3px_0_var(--color-ink)] transition-transform duration-150 ease-out hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_var(--color-ink)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
      aria-label={label}
      aria-live="polite"
      onClick={() => copyText(value, setCopied)}
    >
      {copied ? <Confirm /> : <Copy />}
    </button>
  );
}
