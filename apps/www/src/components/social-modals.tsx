import { Button } from "@blankparticle/ui/primitives/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@blankparticle/ui/primitives/dialog.tsx";

import { CopyButton } from "./copy-button.tsx";

export interface ContactInfo {
  title: string;
  description: string;
  value: string;
  copyLabel: string;
  actions?: { label: string; href: string }[];
}

export const emailContact: ContactInfo = {
  title: "Send me an email",
  description: "I will get back to you as soon as possible.",
  value: "hello@blankparticle.com",
  copyLabel: "Copy email",
  actions: [
    { label: "Open in Gmail", href: "https://mail.google.com/mail/?view=cm&fs=1&to=hello@blankparticle.com" },
    { label: "Open in Outlook", href: "https://outlook.live.com/mail/0/deeplink/compose?to=hello@blankparticle.com" },
  ],
};

export const discordContact: ContactInfo = {
  title: "Let's connect on Discord",
  description: "Add me as a friend with my username below.",
  value: "blankparticle",
  copyLabel: "Copy Discord username",
  actions: [{ label: "Open in Discord", href: "https://discord.com/users/1096392763144159252" }],
};

/** The contact's value in a copyable field; shared by the dialog and the standalone page */
export function ContactValue({ contact }: { contact: ContactInfo }) {
  return (
    <div className="bg-muted flex items-center gap-3 rounded-lg border px-3 py-2">
      <span className="min-w-0 truncate font-mono text-sm font-medium">{contact.value}</span>
      <CopyButton value={contact.value} label={contact.copyLabel} />
    </div>
  );
}

export function ContactDialog({
  open,
  onClose,
  contact,
}: {
  open: boolean;
  onClose: () => void;
  contact: ContactInfo;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact.title}</DialogTitle>
          <DialogDescription>{contact.description}</DialogDescription>
        </DialogHeader>
        <ContactValue contact={contact} />
        {contact.actions && contact.actions.length > 0 && (
          <DialogFooter>
            {contact.actions.map((action) => (
              <Button
                key={action.label}
                variant="sticker-primary"
                size="lg"
                className="h-10 flex-1 whitespace-nowrap"
                nativeButton={false}
                render={<a href={action.href} target="_blank" rel="noopener noreferrer" />}
              >
                {action.label}
              </Button>
            ))}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export interface SocialModalProps {
  open: boolean;
  onClose: () => void;
}

export function EmailModal({ open, onClose }: SocialModalProps) {
  return <ContactDialog open={open} onClose={onClose} contact={emailContact} />;
}

export function DiscordModal({ open, onClose }: SocialModalProps) {
  return <ContactDialog open={open} onClose={onClose} contact={discordContact} />;
}
