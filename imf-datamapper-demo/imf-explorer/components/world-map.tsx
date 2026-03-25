"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Minus, Plus } from "lucide-react";
import type { Indicator } from "@/components/indicator-selector";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface MapDataRow {
  COUNTRY_CODE: string;
  COUNTRY_NAME: string;
  VALUE: number;
}

interface WorldMapProps {
  indicators: Indicator[];
}

// IMF-style color palette: red (negative) → yellow → green (positive)
const COLOR_SCALES: Record<string, { thresholds: number[]; colors: string[] }> = {
  percent: {
    thresholds: [-3, 0, 3, 6],
    colors: [
      "#c0392b", // < -3%: dark red
      "#e67e22", // -3 to 0%: orange
      "#f1c40f", // 0 to 3%: yellow
      "#2ecc71", // 3 to 6%: green
      "#1a9850", // > 6%: dark green
    ],
  },
  percent_gdp: {
    thresholds: [-5, -2, 0, 2],
    colors: [
      "#c0392b",
      "#e67e22",
      "#f1c40f",
      "#2ecc71",
      "#1a9850",
    ],
  },
  billions: {
    thresholds: [100, 500, 2000, 10000],
    colors: [
      "#d4e6f1", // < 100B: lightest
      "#7fb3d8",
      "#2980b9",
      "#1a5276",
      "#0b2545", // > 10T: darkest
    ],
  },
  usd: {
    thresholds: [5000, 15000, 30000, 60000],
    colors: [
      "#d4e6f1",
      "#7fb3d8",
      "#2980b9",
      "#1a5276",
      "#0b2545",
    ],
  },
  millions: {
    thresholds: [10, 50, 200, 1000],
    colors: [
      "#d4e6f1",
      "#7fb3d8",
      "#2980b9",
      "#1a5276",
      "#0b2545",
    ],
  },
  rate: {
    thresholds: [1, 2, 5, 10],
    colors: [
      "#d4e6f1",
      "#7fb3d8",
      "#2980b9",
      "#1a5276",
      "#0b2545",
    ],
  },
};

const NO_DATA_COLOR = "#d5d5d5";
const STROKE_COLOR = "#ffffff";

// world-atlas@2/countries-110m.json uses ISO 3166-1 NUMERIC codes as geo.id
// Our data uses ISO Alpha-3 codes. Map numeric → alpha3 for our 60 countries:
const ISO_NUMERIC_TO_ALPHA3: Record<string, string> = {
  "840": "USA", "826": "GBR", "250": "FRA", "276": "DEU", "392": "JPN",
  "124": "CAN", "380": "ITA", "036": "AUS", "410": "KOR", "156": "CHN",
  "356": "IND", "076": "BRA", "643": "RUS", "484": "MEX", "360": "IDN",
  "792": "TUR", "682": "SAU", "710": "ZAF", "032": "ARG", "724": "ESP",
  "528": "NLD", "756": "CHE", "752": "SWE", "578": "NOR", "616": "POL",
  "702": "SGP", "764": "THA", "704": "VNM", "458": "MYS", "608": "PHL",
  "152": "CHL", "170": "COL", "604": "PER", "818": "EGY", "566": "NGA",
  "404": "KEN", "231": "ETH", "050": "BGD", "586": "PAK", "364": "IRN",
  "368": "IRQ", "784": "ARE", "376": "ISR", "554": "NZL", "372": "IRL",
  "208": "DNK", "246": "FIN", "040": "AUT", "056": "BEL", "620": "PRT",
  "300": "GRC", "203": "CZE", "642": "ROU", "348": "HUN", "804": "UKR",
  "352": "ISL", "442": "LUX", "600": "PRY", "858": "URY", "218": "ECU",
};

function getScaleType(unit: string): string {
  if (unit === "%" || unit.includes("% of")) return "percent";
  if (unit.includes("% of GDP")) return "percent_gdp";
  if (unit.includes("Billions")) return "billions";
  if (unit === "USD" || unit === "Intl$") return "usd";
  if (unit === "Millions") return "millions";
  return "percent"; // default
}

function getColor(value: number | undefined, scaleType: string): string {
  if (value === undefined || value === null) return NO_DATA_COLOR;
  const scale = COLOR_SCALES[scaleType] || COLOR_SCALES.percent;
  for (let i = 0; i < scale.thresholds.length; i++) {
    if (value < scale.thresholds[i]) return scale.colors[i];
  }
  return scale.colors[scale.colors.length - 1];
}

function formatLegendValue(v: number, unit: string): string {
  if (unit.includes("Billions")) {
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}T`;
    return `${v.toFixed(0)}B`;
  }
  if (unit === "%" || unit.includes("%")) return `${v}%`;
  if (unit === "Millions") return `${v}M`;
  if (unit === "USD" || unit === "Intl$") {
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
    return `$${v}`;
  }
  return v.toString();
}

function formatTooltipValue(v: number, unit: string): string {
  if (unit.includes("Billions")) return `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })} B`;
  if (unit === "%" || unit.includes("%")) return `${v.toFixed(2)}%`;
  if (unit === "Millions") return `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })} M`;
  if (unit === "USD" || unit === "Intl$") return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function WorldMap({ indicators }: WorldMapProps) {
  const [selectedIndicator, setSelectedIndicator] = useState(
    indicators[0]?.INDICATOR || ""
  );
  const [year, setYear] = useState(2024);
  const [mapData, setMapData] = useState<MapDataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState<{
    name: string;
    value: string;
    x: number;
    y: number;
  } | null>(null);

  const indicatorMeta = useMemo(
    () => indicators.find((i) => i.INDICATOR === selectedIndicator),
    [indicators, selectedIndicator]
  );

  const scaleType = useMemo(
    () => (indicatorMeta ? getScaleType(indicatorMeta.UNIT) : "percent"),
    [indicatorMeta]
  );

  const dataMap = useMemo(() => {
    const m = new Map<string, MapDataRow>();
    for (const row of mapData) {
      m.set(row.COUNTRY_CODE, row);
    }
    return m;
  }, [mapData]);

  const fetchMapData = useCallback(async () => {
    if (!selectedIndicator) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        indicator: selectedIndicator,
        year: year.toString(),
      });
      const res = await fetch(`/api/map?${params}`);
      if (res.ok) {
        const rows = await res.json();
        setMapData(rows);
      }
    } catch {
      // silently fail — map just shows no data
    } finally {
      setLoading(false);
    }
  }, [selectedIndicator, year]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  const scale = COLOR_SCALES[scaleType] || COLOR_SCALES.percent;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">World Map</CardTitle>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedIndicator} onValueChange={setSelectedIndicator}>
              <SelectTrigger className="w-[260px] h-9 text-xs">
                <SelectValue placeholder="Select indicator" />
              </SelectTrigger>
              <SelectContent>
                {indicators.map((ind) => (
                  <SelectItem key={ind.INDICATOR} value={ind.INDICATOR}>
                    {ind.INDICATOR_NAME}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setYear((y) => Math.max(1980, y - 1))}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                min={1980}
                max={2030}
                value={year}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1980 && v <= 2030) setYear(v);
                }}
                className="w-20 h-9 text-center text-sm tabular-nums"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setYear((y) => Math.min(2030, y + 1))}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ComposableMap
            projectionConfig={{ rotate: [-10, 0, 0], scale: 147 }}
            width={800}
            height={400}
            style={{ width: "100%", height: "auto" }}
          >
            <ZoomableGroup>
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const isoA3 = ISO_NUMERIC_TO_ALPHA3[geo.id] || "";
                    const row = dataMap.get(isoA3);
                    const fillColor = getColor(row?.VALUE, scaleType);
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fillColor}
                        stroke={STROKE_COLOR}
                        strokeWidth={0.5}
                        onMouseEnter={(evt) => {
                          const name =
                            row?.COUNTRY_NAME ||
                            geo.properties.name ||
                            "Unknown";
                          const value = row
                            ? formatTooltipValue(
                                row.VALUE,
                                indicatorMeta?.UNIT || ""
                              )
                            : "No data";
                          setTooltip({
                            name,
                            value,
                            x: evt.clientX,
                            y: evt.clientY,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          default: { outline: "none" },
                          hover: {
                            outline: "none",
                            fill: row ? fillColor : "#bbb",
                            opacity: 0.8,
                            cursor: "pointer",
                          },
                          pressed: { outline: "none" },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="fixed z-50 pointer-events-none bg-popover border border-border rounded-md shadow-md px-3 py-2 text-sm"
              style={{
                left: tooltip.x + 12,
                top: tooltip.y - 30,
              }}
            >
              <p className="font-medium">{tooltip.name}</p>
              <p className="text-muted-foreground">{tooltip.value}</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-1 mt-3 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">
            {indicatorMeta?.INDICATOR_NAME || ""}
            {indicatorMeta?.UNIT ? ` (${indicatorMeta.UNIT})` : ""}
          </span>
          <div className="flex items-center gap-0.5">
            {scale.colors.map((color, i) => {
              const label =
                i === 0
                  ? `< ${formatLegendValue(scale.thresholds[0], indicatorMeta?.UNIT || "")}`
                  : i === scale.colors.length - 1
                    ? `> ${formatLegendValue(scale.thresholds[i - 1], indicatorMeta?.UNIT || "")}`
                    : `${formatLegendValue(scale.thresholds[i - 1], indicatorMeta?.UNIT || "")} – ${formatLegendValue(scale.thresholds[i], indicatorMeta?.UNIT || "")}`;
              return (
                <div key={i} className="flex flex-col items-center">
                  <div
                    className="w-10 h-3 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {label}
                  </span>
                </div>
              );
            })}
            <div className="flex flex-col items-center ml-1">
              <div
                className="w-10 h-3 rounded-sm"
                style={{ backgroundColor: NO_DATA_COLOR }}
              />
              <span className="text-[10px] text-muted-foreground mt-0.5">
                No data
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
