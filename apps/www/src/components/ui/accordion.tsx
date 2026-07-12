import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";

import { cn } from "@/lib/utils";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return <AccordionPrimitive.Root data-slot="accordion" className={cn("flex w-full flex-col", className)} {...props} />;
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-violet/35 border-t-2 border-dashed last:border-b-2", className)}
      {...props}
    />
  );
}

function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger focus-visible:ring-ring/50 flex flex-1 cursor-pointer items-center gap-4 rounded-lg py-5 text-left outline-none focus-visible:ring-3 aria-disabled:pointer-events-none aria-disabled:opacity-50 sm:gap-6",
          className,
        )}
        {...props}
      >
        <span
          className="text-orange-deep shrink-0 text-lg font-bold transition-transform duration-200 ease-out group-aria-expanded/accordion-trigger:rotate-90"
          aria-hidden="true"
        >
          →
        </span>
        {children}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="data-open:animate-accordion-down data-closed:animate-accordion-up overflow-hidden text-sm"
      {...props}
    >
      <div
        className={cn(
          "h-(--accordion-panel-height) data-ending-style:h-0 data-starting-style:h-0 pb-5 pl-10 sm:pl-12",
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
