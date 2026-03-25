import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/snowflake";

interface CompareRow {
  COUNTRY_NAME: string;
  COUNTRY_CODE: string;
  INDICATOR: string;
  INDICATOR_NAME: string;
  UNIT: string;
  YEAR: number;
  VALUE: number;
}

const VALID_COUNTRY_CODE = /^[A-Z]{2,3}$/;
const VALID_INDICATOR = /^[A-Z_]+$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const countriesParam = searchParams.get("countries") || "";
    const indicatorsParam = searchParams.get("indicators") || "";
    const startYear = parseInt(searchParams.get("startYear") || "2000", 10);
    const endYear = parseInt(searchParams.get("endYear") || "2030", 10);

    const countries = countriesParam
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const indicators = indicatorsParam
      .split(",")
      .map((i) => i.trim())
      .filter(Boolean);

    if (countries.length === 0 || indicators.length === 0) {
      return NextResponse.json(
        { error: "Both countries and indicators are required" },
        { status: 400 }
      );
    }

    if (countries.length > 10 || indicators.length > 15) {
      return NextResponse.json(
        { error: "Maximum 10 countries and 15 indicators" },
        { status: 400 }
      );
    }

    for (const c of countries) {
      if (!VALID_COUNTRY_CODE.test(c)) {
        return NextResponse.json(
          { error: `Invalid country code: ${c}` },
          { status: 400 }
        );
      }
    }
    for (const i of indicators) {
      if (!VALID_INDICATOR.test(i)) {
        return NextResponse.json(
          { error: `Invalid indicator: ${i}` },
          { status: 400 }
        );
      }
    }

    if (
      isNaN(startYear) ||
      isNaN(endYear) ||
      startYear < 1980 ||
      endYear > 2030 ||
      startYear > endYear
    ) {
      return NextResponse.json(
        { error: "Invalid year range (1980-2030)" },
        { status: 400 }
      );
    }

    const countryList = countries.map((c) => `'${c}'`).join(",");
    const indicatorList = indicators.map((i) => `'${i}'`).join(",");

    const sql = `
      SELECT
        c.COUNTRY_NAME,
        c.COUNTRY_CODE,
        i.INDICATOR,
        m.INDICATOR_NAME,
        m.UNIT,
        i.YEAR,
        i.VALUE
      FROM API_DEMO.PUBLIC.IMF_DATAMAPPER_INDICATORS i
      JOIN API_DEMO.PUBLIC.COUNTRY_METADATA c ON i.COUNTRY_CODE = c.COUNTRY_CODE
      JOIN API_DEMO.PUBLIC.INDICATOR_METADATA m ON i.INDICATOR = m.INDICATOR
      WHERE c.COUNTRY_CODE IN (${countryList})
        AND i.INDICATOR IN (${indicatorList})
        AND i.YEAR BETWEEN ${startYear} AND ${endYear}
      ORDER BY i.INDICATOR, c.COUNTRY_NAME, i.YEAR
    `;

    const rows = await query<CompareRow>(sql);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching comparison data:", error);
    return NextResponse.json(
      { error: "Failed to fetch comparison data" },
      { status: 500 }
    );
  }
}
