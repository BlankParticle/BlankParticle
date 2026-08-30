import { ArrowRightIcon } from "@blankparticle/ui/icons";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@blankparticle/ui/primitives/accordion.tsx";

import type { workHistory } from "#/lib/data.ts";

/** Roles as an accordion: the newest one open, each with its bullet points */
export function WorkHistory({ items }: { items: typeof workHistory }) {
  return (
    <Accordion defaultValue={[items[0]!.company]} className="rule-dots border-t-2">
      {items.map((work) => (
        <AccordionItem
          key={work.company}
          value={work.company}
          className="rule-dots before:bg-primary/4 relative isolate border-b-2 not-last:border-b-2 before:absolute before:-inset-x-3 before:inset-y-1 before:-z-10 before:rounded-lg before:opacity-0 before:transition-opacity hover:before:opacity-100"
        >
          <AccordionTrigger
            icon={null}
            className="cursor-pointer items-center gap-4 py-5 font-sans hover:no-underline sm:gap-5"
          >
            <img
              src={work.logo}
              alt={`${work.company} logo`}
              loading="lazy"
              className="ring-foreground/10 size-10 shrink-0 rounded-lg object-cover ring-1"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <a
                  href={work.url}
                  className="font-heading link-dots text-violet-deep text-xl font-bold"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {work.company}
                </a>
                {work.companySubtext && <span className="text-muted-foreground text-xs">{work.companySubtext}</span>}
              </span>
              <span className="text-muted-foreground text-sm font-normal">
                {work.role} · {work.tags.join(" · ")}
              </span>
            </span>
            <span className="font-heading text-orange-deep hidden shrink-0 text-sm font-bold tabular-nums sm:inline">
              {work.date}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-5 pl-14 sm:pl-15">
            <span className="font-heading text-orange-deep mb-2 block text-sm font-bold tabular-nums sm:hidden">
              {work.date}
            </span>
            <ul className="flex flex-col gap-2">
              {work.points.map((point) => (
                <li key={point} className="text-muted-foreground flex gap-2.5 text-sm leading-relaxed">
                  <ArrowRightIcon
                    weight="bold"
                    className="text-orange-deep mt-1.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
