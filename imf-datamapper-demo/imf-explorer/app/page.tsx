"use client";

import { useState, useEffect, useCallback } from "react";
import { Globe, BarChart3, Loader2, Table2, LineChartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  CountrySelector,
  type Country,
} from "@/components/country-selector";
import {
  IndicatorSelector,
  type Indicator,
} from "@/components/indicator-selector";
import { YearRangeSelector } from "@/components/year-range-selector";
import {
  ComparisonChart,
  type CompareRow,
} from "@/components/comparison-chart";
import { DataTable } from "@/components/data-table";
import { WorldMap } from "@/components/world-map";

export default function Home() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [startYear, setStartYear] = useState(2015);
  const [endYear, setEndYear] = useState(2030);
  const [data, setData] = useState<CompareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/countries").then((r) => r.json()),
      fetch("/api/indicators").then((r) => r.json()),
    ])
      .then(([c, i]) => {
        setCountries(c);
        setIndicators(i);
        setInitialLoading(false);
      })
      .catch((err) => {
        setError("Failed to load metadata: " + err.message);
        setInitialLoading(false);
      });
  }, []);

  const fetchData = useCallback(async () => {
    if (selectedCountries.length === 0 || selectedIndicators.length === 0)
      return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        countries: selectedCountries.join(","),
        indicators: selectedIndicators.join(","),
        startYear: startYear.toString(),
        endYear: endYear.toString(),
      });
      const res = await fetch(`/api/compare?${params}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to fetch data");
      }
      const rows = await res.json();
      setData(rows);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedCountries, selectedIndicators, startYear, endYear]);

  const canCompare =
    selectedCountries.length > 0 && selectedIndicators.length > 0;

  const uniqueIndicators = [...new Set(data.map((d) => d.INDICATOR))];

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Connecting to Snowflake...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              IMF Economic Explorer
            </h1>
            <p className="text-xs text-muted-foreground">
              World Economic Outlook &middot; {countries.length} countries
              &middot; {indicators.length} indicators &middot; 1980&ndash;2030
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 border-r bg-card p-4 space-y-4 overflow-y-auto shrink-0">
          <CountrySelector
            countries={countries}
            selected={selectedCountries}
            onChange={setSelectedCountries}
          />
          <Separator />
          <IndicatorSelector
            indicators={indicators}
            selected={selectedIndicators}
            onChange={setSelectedIndicators}
          />
          <Separator />
          <YearRangeSelector
            startYear={startYear}
            endYear={endYear}
            onChange={(s, e) => {
              setStartYear(s);
              setEndYear(e);
            }}
          />
          <Separator />
          <Button
            className="w-full"
            size="lg"
            disabled={!canCompare || loading}
            onClick={fetchData}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <BarChart3 className="mr-2 h-4 w-4" />
                Compare
              </>
            )}
          </Button>
          {!canCompare && (
            <p className="text-xs text-muted-foreground text-center">
              Select at least one country and one indicator
            </p>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {error && (
            <Card className="border-destructive mb-4">
              <CardContent className="py-3">
                <p className="text-sm text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {data.length === 0 && !loading && !error && (
            <div className="space-y-6">
              {indicators.length > 0 && (
                <WorldMap indicators={indicators} />
              )}
              <div className="flex flex-col items-center justify-center text-center space-y-3 text-muted-foreground py-8">
                <Globe className="h-12 w-12 opacity-30" />
                <div>
                  <p className="text-lg font-medium">
                    Select countries and indicators to compare
                  </p>
                  <p className="text-sm mt-1">
                    Use the sidebar to pick countries, indicators, and a year
                    range, then click Compare.
                  </p>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-4 w-48 mb-4" />
                    <Skeleton className="h-72 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {data.length > 0 && !loading && (
            <Tabs defaultValue="charts" className="space-y-4">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="charts">
                    <LineChartIcon className="h-4 w-4 mr-1.5" />
                    Charts
                  </TabsTrigger>
                  <TabsTrigger value="map">
                    <Globe className="h-4 w-4 mr-1.5" />
                    Map
                  </TabsTrigger>
                  <TabsTrigger value="table">
                    <Table2 className="h-4 w-4 mr-1.5" />
                    Data
                  </TabsTrigger>
                </TabsList>
                <Badge variant="outline" className="text-xs">
                  {data.length.toLocaleString()} data points
                </Badge>
              </div>

              <TabsContent value="charts" className="space-y-4">
                {uniqueIndicators.map((ind) => (
                  <ComparisonChart key={ind} data={data} indicator={ind} />
                ))}
              </TabsContent>

              <TabsContent value="map">
                <WorldMap indicators={indicators} />
              </TabsContent>

              <TabsContent value="table">
                <DataTable data={data} />
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>
    </div>
  );
}
