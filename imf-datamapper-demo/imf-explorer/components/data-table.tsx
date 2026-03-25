"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompareRow } from "@/components/comparison-chart";

interface DataTableProps {
  data: CompareRow[];
}

type SortKey = "COUNTRY_NAME" | "INDICATOR_NAME" | "YEAR" | "VALUE";

export function DataTable({ data }: DataTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("COUNTRY_NAME");
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [data, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortHeader = ({
    label,
    field,
    className,
  }: {
    label: string;
    field: SortKey;
    className?: string;
  }) => (
    <th className={`px-3 py-2 text-left text-xs font-medium text-muted-foreground ${className || ""}`}>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-0 text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => toggleSort(field)}
      >
        {label}
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    </th>
  );

  function formatValue(value: number, unit: string): string {
    if (unit.includes("Billions")) {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
    }
    if (unit === "%" || unit.includes("%")) {
      return `${value.toFixed(2)}%`;
    }
    if (unit === "Millions") {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
    }
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return (
    <div className="rounded-md border overflow-auto max-h-[600px]">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 sticky top-0">
          <tr>
            <SortHeader label="Country" field="COUNTRY_NAME" />
            <SortHeader label="Indicator" field="INDICATOR_NAME" />
            <SortHeader label="Year" field="YEAR" className="text-right" />
            <SortHeader label="Value" field="VALUE" className="text-right" />
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Unit
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={`${row.COUNTRY_CODE}-${row.INDICATOR}-${row.YEAR}`}
              className={i % 2 === 0 ? "" : "bg-muted/20"}
            >
              <td className="px-3 py-1.5 font-medium">{row.COUNTRY_NAME}</td>
              <td className="px-3 py-1.5 text-muted-foreground">
                {row.INDICATOR_NAME}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {row.YEAR}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums font-mono">
                {formatValue(row.VALUE, row.UNIT)}
              </td>
              <td className="px-3 py-1.5 text-muted-foreground text-xs">
                {row.UNIT}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
