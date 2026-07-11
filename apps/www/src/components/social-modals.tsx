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
  actions?: { label: string; href: string }[];
}

export default function ContactDialog({ open, onClose, title, description, value, copyLabel, actions }: Props) {
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
        className="border-ink bg-paper relative flex w-full max-w-md flex-col gap-5 rounded-lg border-2 p-6 shadow-[6px_6px_0_var(--color-ink)]"
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
        {actions && actions.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row">
            {actions.map((action) => (
              <PushButton
                key={action.label}
                href={action.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center whitespace-nowrap"
              >
                {action.label}
              </PushButton>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export interface SocialModalProps {
  open: boolean;
  onClose: () => void;
}

export function EmailModal({ open, onClose }: SocialModalProps) {
  return (
    <ContactDialog
      open={open}
      onClose={onClose}
      title="Drop me a line"
      description="Send me an email, I will get back to you as soon as possible."
      value={`hello@blankparticle.com`}
      copyLabel="Copy email"
      actions={[
        { label: "Open in Gmail", href: `https://mail.google.com/mail/?view=cm&fs=1&to=hello@blankparticle.com` },
        {
          label: "Open in Outlook",
          href: `https://outlook.live.com/mail/0/deeplink/compose?to=hello@blankparticle.com`,
        },
      ]}
    />
  );
}

export function DiscordModal({ open, onClose }: SocialModalProps) {
  return (
    <ContactDialog
      open={open}
      onClose={onClose}
      title="Let's connect on Discord"
      description="Add me as a friend with my username below."
      value={"blankparticle"}
      copyLabel="Copy Discord username"
      actions={[{ label: "Open in Discord", href: "/discord" }]}
    />
  );
}
