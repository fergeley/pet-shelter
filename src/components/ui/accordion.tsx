"use client";

import * as React from "react";
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Accordion primitives built on Base UI, the component library this project
 * already depends on. Base UI handles the ARIA wiring, keyboard interaction
 * and the panel height measurement exposed as `--accordion-panel-height`.
 */
function Accordion({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  );
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b border-border last:border-b-0", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group flex flex-1 items-start justify-between gap-4 py-5 text-left",
          "font-heading text-base sm:text-lg font-bold text-foreground",
          "transition-colors hover:text-foreground/75",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-lg",
          "disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[panel-open]:rotate-180"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionPanel({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Panel>) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-panel"
      // `hiddenUntilFound` on the Root keeps closed panels in the DOM so the
      // browser's own Ctrl+F can find and reveal them.
      className={cn(
        "h-[var(--accordion-panel-height)] overflow-hidden transition-[height] duration-200 ease-out",
        "data-[starting-style]:h-0 data-[ending-style]:h-0",
        className
      )}
      {...props}
    >
      <div className={cn("pb-5 pr-8 text-sm sm:text-base leading-relaxed text-muted-foreground")}>
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionPanel };
