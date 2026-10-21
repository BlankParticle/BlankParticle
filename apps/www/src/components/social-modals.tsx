import { Button } from "@blankparticle/ui/primitives/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@blankparticle/ui/primitives/dialog.tsx";

import type { Contact } from "#/lib/contacts.ts";

import { CopyButton } from "./copy-button.tsx";

/** The contact's value in a copyable field; shared by the dialog and the standalone page */
export function ContactValue({ contact }: { contact: Contact }) {
  return (
    <div className="bg-muted flex items-center gap-3 rounded-lg border px-3 py-2">
      <span className="min-w-0 truncate font-mono text-sm font-medium">{contact.value}</span>
      <CopyButton value={contact.value} label={contact.copyLabel} />
    </div>
  );
}

/** The contact's "Open in …" buttons; the dialog and the standalone page each lay them out */
export function ContactActions({ contact }: { contact: Contact }) {
  return contact.actions.map((action) => (
    <Button
      key={action.label}
      variant="sticker-primary"
      size="lg"
      className="h-10 w-full whitespace-nowrap sm:w-auto sm:flex-1"
      nativeButton={false}
      render={<a href={action.href} target="_blank" rel="noopener noreferrer" />}
    >
      {action.label}
    </Button>
  ));
}

export function ContactDialog({ open, onClose, contact }: { open: boolean; onClose: () => void; contact: Contact }) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact.title}</DialogTitle>
          <DialogDescription>{contact.description}</DialogDescription>
        </DialogHeader>
        <ContactValue contact={contact} />
        <DialogFooter className="flex-col">
          <ContactActions contact={contact} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
