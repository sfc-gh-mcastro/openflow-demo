"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface CompareRow {
  COUNTRY_NAME: string;
  COUNTRY_CODE: string;
  INDICATOR: string;
  INDICATOR_NAME: string;
  UNIT: string;
  YEAR: number;
  VALUE: number;
}

interface ComparisonChartProps {
  data: CompareRow[];
  indicator: string;
}

const CHART_COLORS = [
  "hsl(221, 83%, 53%)",   // blue
  "hsl(0, 84%, 60%)",     // red
  "hsl(142, 71%, 45%)",   // green
  "hsl(38, 92%, 50%)",    // amber
  "hsl(262, 83%, 58%)",   // purple
  "hsl(173, 80%, 40%)",   // teal
  "hsl(326, 80%, 52%)",   // pink
  "hsl(24, 95%, 53%)",    // orange
  "hsl(199, 89%, 48%)",   // sky
  "hsl(47, 96%, 53%)",    // yellow
];

function formatValue(value: number, unit: string): string {
  if (unit.includes("Billions")) {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}T`;
    return `${value.toFixed(1)}B`;
  }
  if (unit === "%" || unit.includes("%")) {
    return `${value.toFixed(1)}%`;
  }
  if (unit === "Millions") {
    return `${value.toFixed(1)}M`;
  }
  if (unit === "USD" || unit === "Intl$") {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toFixed(0);
  }
  return value.toFixed(2);
}

export function ComparisonChart({ data, indicator }: ComparisonChartProps) {
  const indicatorData = data.filter((d) => d.INDICATOR === indicator);

  if (indicatorData.length === 0) return null;

  const meta = indicatorData[0];
  const countries = [...new Set(indicatorData.map((d) => d.COUNTRY_NAME))];
  const years = [...new Set(indicatorData.map((d) => d.YEAR))].sort();

  const chartData = years.map((year) => {
    const point: Record<string, number | string> = { year };
    for (const country of countries) {
      const row = indicatorData.find(
        (d) => d.YEAR === year && d.COUNTRY_NAME === country
      );
      if (row) point[country] = row.VALUE;
    }
    return point;
  });

  const currentYear = new Date().getFullYear();

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-base">{meta.INDICATOR_NAME}</CardTitle>
          <Badge variant="outline" className="text-xs font-normal">
            {meta.UNIT}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border"
              />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
                tickFormatter={(v) => formatValue(v, meta.UNIT)}
                width={65}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  fontSize: 13,
                }}
                formatter={(value: number) => [
                  formatValue(value, meta.UNIT),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {years.includes(currentYear) && (
                <ReferenceLine
                  x={currentYear}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  label={{
                    value: "Now",
                    position: "top",
                    fontSize: 11,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
              )}
              {countries.map((country, i) => (
                <Line
                  key={country}
                  type="monotone"
                  dataKey={country}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
