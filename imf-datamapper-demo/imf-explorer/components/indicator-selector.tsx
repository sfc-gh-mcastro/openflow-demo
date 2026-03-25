"use client";

import { useState } from "react";
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

export interface Indicator {
  INDICATOR: string;
  INDICATOR_NAME: string;
  UNIT: string;
  DESCRIPTION: string;
}

interface IndicatorSelectorProps {
  indicators: Indicator[];
  selected: string[];
  onChange: (codes: string[]) => void;
}

const KEY_INDICATORS = [
  "NGDP_RPCH",
  "PCPIPCH",
  "LUR",
  "NGDPD",
  "GGXWDG_NGDP",
];

export function IndicatorSelector({
  indicators,
  selected,
  onChange,
}: IndicatorSelectorProps) {
  const [open, setOpen] = useState(false);

  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  const selectedIndicators = selected
    .map((code) => indicators.find((i) => i.INDICATOR === code))
    .filter(Boolean);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Indicators</label>
      <div className="flex gap-1.5 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onChange(KEY_INDICATORS)}
        >
          Key metrics
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onChange(["NGDP_RPCH", "PCPIPCH", "LUR"])}
        >
          Growth + Inflation + Jobs
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
            <span className="text-muted-foreground">
              Select indicators...
            </span>
          ) : (
            <span className="text-sm">{selected.length} selected</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search indicators..." />
            <CommandList>
              <CommandEmpty>No indicator found.</CommandEmpty>
              <CommandGroup>
                {indicators.map((ind) => (
                  <CommandItem
                    key={ind.INDICATOR}
                    value={ind.INDICATOR_NAME}
                    onSelect={() => toggle(ind.INDICATOR)}
                    data-checked={selected.includes(ind.INDICATOR)}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm">{ind.INDICATOR_NAME}</span>
                      <span className="text-xs text-muted-foreground">
                        {ind.UNIT}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedIndicators.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedIndicators.map((ind) => (
            <Badge
              key={ind!.INDICATOR}
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-destructive/20"
              onClick={() => toggle(ind!.INDICATOR)}
            >
              {ind!.INDICATOR_NAME}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
