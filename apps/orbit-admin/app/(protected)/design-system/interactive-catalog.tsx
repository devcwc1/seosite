"use client";

import * as React from "react";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { CountedInput, CountedTextarea } from "@/components/ui/counted-field";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * The parts of the catalog that need state. Split from the page so the rest
 * stays a server component.
 */
const CATEGORIES = [
  { value: "medicines", label: "Medicines" },
  { value: "vitamins", label: "Vitamins" },
  { value: "skincare", label: "Skincare" },
  { value: "stationery", label: "Stationery" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-section-title">{title}</h2>
        <p className="text-muted-foreground text-body">{description}</p>
      </div>
      <div className="bg-background rounded-lg border p-4">{children}</div>
    </section>
  );
}

export function InteractiveCatalog() {
  const [title, setTitle] = React.useState("Paracetamol 500mg");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<string | null>("vitamins");
  const [dismissed, setDismissed] = React.useState(false);

  return (
    <>
      <Section
        title="Counted fields"
        description="The remaining count is wired through aria-describedby, so it is announced and not merely visible. Type past 55 characters to see the warning tone."
      >
        <div className="flex max-w-[32rem] flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="catalog-title">Meta title</Label>
            <CountedInput
              id="catalog-title"
              maxLength={60}
              warnAt={5}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="catalog-description">Meta description</Label>
            <CountedTextarea
              id="catalog-description"
              maxLength={160}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Combobox"
        description="Type-ahead select for lists too long to scan. Opens with Enter, filters as you type, and selecting the current value clears it."
      >
        <div className="max-w-[20rem]">
          <Combobox
            options={CATEGORIES}
            value={category}
            onChange={setCategory}
            ariaLabel="Category"
            placeholder="Choose a category"
          />
        </div>
      </Section>

      <Section
        title="Drawer"
        description="A sheet for secondary flows that should not lose the page behind them. Focus is trapped while open and restored to the trigger on close."
      >
        <Sheet>
          <SheetTrigger render={<Button variant="outline" />}>
            Open drawer
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filter products</SheetTitle>
              <SheetDescription>
                Press Escape or Tab to the close button to dismiss.
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </Section>

      <Section
        title="Dismissible banner"
        description="The dismiss control is named after the message it removes."
      >
        {dismissed ? (
          <Button variant="outline" onClick={() => setDismissed(false)}>
            Bring it back
          </Button>
        ) : (
          <Banner
            tone="warning"
            title="2 products have no meta description"
            onDismiss={() => setDismissed(true)}
          />
        )}
      </Section>
    </>
  );
}
