import { useEffect } from "react";

import CopyButton from "./copy-button";
import PushButton from "./push-button";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  value: string;
  copyLabel: string;
  actionHref?: string;
  actionLabel?: string;
}

export default function ContactDialog({
  open,
  onClose,
  title,
  description,
  value,
  copyLabel,
  actionHref,
  actionLabel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="bg-ink/40 fixed inset-0 z-50 flex items-center justify-center p-5"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="border-ink bg-paper relative flex w-full max-w-sm flex-col gap-5 rounded-lg border-2 p-6 shadow-[6px_6px_0_var(--color-ink)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <button
          type="button"
          className="border-ink bg-paper text-ink hover:bg-orange-deep hover:text-paper absolute -top-2.5 -right-2.5 grid size-8 cursor-pointer place-items-center rounded-full border-2 text-sm font-bold transition-colors duration-150"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
        <h2 className="font-display text-violet text-2xl font-extrabold tracking-tight">{title}</h2>
        <p className="text-ink-muted text-sm">{description}</p>
        <div className="border-violet/50 bg-lime/20 flex items-center gap-3 rounded-md border-2 border-dashed px-4 py-3">
          <span className="text-ink min-w-0 truncate font-bold">{value}</span>
          <CopyButton value={value} label={copyLabel} />
        </div>
        {actionHref && actionLabel && (
          <PushButton href={actionHref} target="_blank" rel="noopener noreferrer" className="text-center">
            {actionLabel}
          </PushButton>
        )}
      </div>
    </div>
  );
}
