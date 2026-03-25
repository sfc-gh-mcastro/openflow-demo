"use client";

import { Button } from "@/components/ui/button";

interface YearRangeSelectorProps {
  startYear: number;
  endYear: number;
  onChange: (start: number, end: number) => void;
}

const PRESETS = [
  { label: "Last 10y", start: 2016, end: 2026 },
  { label: "2000s", start: 2000, end: 2010 },
  { label: "Forecast", start: 2025, end: 2030 },
  { label: "Full range", start: 1980, end: 2030 },
];

export function YearRangeSelector({
  startYear,
  endYear,
  onChange,
}: YearRangeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Year Range</label>
      <div className="flex gap-1.5 flex-wrap">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            variant={
              startYear === p.start && endYear === p.end
                ? "default"
                : "outline"
            }
            size="sm"
            className="h-7 text-xs"
            onClick={() => onChange(p.start, p.end)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1980}
          max={endYear}
          value={startYear}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 1980 && v <= endYear) onChange(v, endYear);
          }}
          className="w-20 h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <span className="text-muted-foreground text-sm">to</span>
        <input
          type="number"
          min={startYear}
          max={2030}
          value={endYear}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= startYear && v <= 2030)
              onChange(startYear, v);
          }}
          className="w-20 h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>
    </div>
  );
}
