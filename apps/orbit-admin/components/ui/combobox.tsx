"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A single-select with type-ahead, for lists too long to scan — categories,
 * users, countries. Below roughly a dozen options a plain `Select` is kinder;
 * this exists for when it is not.
 *
 * Built on the Base UI popover and the Command primitive, so listbox
 * semantics, focus trapping and type-ahead come from parts that have already
 * argued with screen readers, rather than from a div with a click handler.
 */
export type ComboboxOption = { value: string; label: string };

export type ComboboxProps = {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Shown on the trigger when nothing is chosen. */
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Names the trigger for assistive tech. Required — there is no visible label. */
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
};

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "Nothing found.",
  ariaLabel,
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Base UI composes through `render`, not `asChild`. */}
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={ariaLabel}
            disabled={disabled}
            className={cn("w-full justify-between font-normal", className)}
          />
        }
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
      </PopoverTrigger>

      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      // Choosing the current value clears it — the only way
                      // back to "nothing selected" without a separate control.
                      onChange(isSelected ? null : option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden
                    />
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
