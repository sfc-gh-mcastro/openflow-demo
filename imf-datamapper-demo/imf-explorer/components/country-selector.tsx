"use client";

import { useState, useMemo } from "react";
import { ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface Country {
  COUNTRY_CODE: string;
  COUNTRY_NAME: string;
  REGION: string;
  INCOME_GROUP: string;
  IS_G7: boolean;
  IS_G20: boolean;
  IS_EMERGING: boolean;
}

interface CountrySelectorProps {
  countries: Country[];
  selected: string[];
  onChange: (codes: string[]) => void;
}

export function CountrySelector({
  countries,
  selected,
  onChange,
}: CountrySelectorProps) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const groups: Record<string, Country[]> = {};
    for (const c of countries) {
      if (!groups[c.REGION]) groups[c.REGION] = [];
      groups[c.REGION].push(c);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [countries]);

  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else if (selected.length < 10) {
      onChange([...selected, code]);
    }
  };

  const presetSelect = (filter: (c: Country) => boolean) => {
    const codes = countries.filter(filter).map((c) => c.COUNTRY_CODE);
    onChange(codes);
  };

  const selectedNames = selected.map(
    (code) =>
      countries.find((c) => c.COUNTRY_CODE === code)?.COUNTRY_NAME ?? code
  );

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Countries</label>
      <div className="flex gap-1.5 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => presetSelect((c) => c.IS_G7)}
        >
          G7
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => presetSelect((c) => c.IS_G20)}
        >
          G20
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => presetSelect((c) => c.IS_EMERGING)}
        >
          Emerging
        </Button>
        {selected.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => onChange([])}
          >
            Clear
          </Button>
        )}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="flex h-auto min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground cursor-pointer"
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground">Select countries...</span>
          ) : (
            <span className="text-sm">{selected.length} selected</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search countries..." />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              {grouped.map(([region, regionCountries]) => (
                <CommandGroup key={region} heading={region}>
                  {regionCountries.map((c) => (
                    <CommandItem
                      key={c.COUNTRY_CODE}
                      value={c.COUNTRY_NAME}
                      onSelect={() => toggle(c.COUNTRY_CODE)}
                      data-checked={selected.includes(c.COUNTRY_CODE)}
                    >
                      {c.COUNTRY_NAME}
                      {c.IS_G7 && (
                        <Badge
                          variant="secondary"
                          className="ml-auto text-[10px] px-1 py-0"
                        >
                          G7
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedNames.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedNames.map((name, i) => (
            <Badge
              key={selected[i]}
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-destructive/20"
              onClick={() => toggle(selected[i])}
            >
              {name}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
