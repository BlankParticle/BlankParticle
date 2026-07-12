import { CopyButton } from "./copy-button.tsx";
import { Button } from "./ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog.tsx";

interface ContactDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  value: string;
  copyLabel: string;
  actions?: { label: string; href: string }[];
}

export function ContactDialog({ open, onClose, title, description, value, copyLabel, actions }: ContactDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="border-violet/50 bg-lime/20 flex items-center gap-3 rounded-md border-2 border-dashed px-4 py-3">
          <span className="text-ink min-w-0 truncate font-bold">{value}</span>
          <CopyButton value={value} label={copyLabel} />
        </div>
        {actions && actions.length > 0 && (
          <DialogFooter>
            {actions.map((action) => (
              <Button
                key={action.label}
                variant="violet"
                className="flex-1 whitespace-nowrap"
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
  return (
    <ContactDialog
      open={open}
      onClose={onClose}
      title="Send me an email"
      description="I will get back to you as soon as possible."
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
