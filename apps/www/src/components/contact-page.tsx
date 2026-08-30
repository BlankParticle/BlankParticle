import { Button } from "@blankparticle/ui/primitives/button.tsx";

import { SiteLayout } from "./site-layout.tsx";
import { ContactValue, type ContactInfo } from "./social-modals.tsx";

export function ContactPage({ contact }: { contact: ContactInfo }) {
  return (
    <SiteLayout back={{ to: "/", label: "blankparticle.com" }}>
      <section className="flex flex-1 items-center justify-center">
        <div className="reveal reveal-90 relative w-full max-w-md">
          <span className="halftone text-orange absolute -top-8 -right-6 size-24" aria-hidden="true" />
          <span className="halftone text-primary absolute -bottom-6 -left-7 size-20" aria-hidden="true" />
          <div className="sticker sticker-lg sticker-primary bg-card relative rounded-2xl p-6 sm:p-8">
            <h1 className="text-primary text-3xl font-extrabold">{contact.title}</h1>
            <p className="text-muted-foreground pt-2 text-sm">{contact.description}</p>
            <div className="mt-6">
              <ContactValue contact={contact} />
            </div>
            {contact.actions && contact.actions.length > 0 && (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
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
              </div>
            )}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
