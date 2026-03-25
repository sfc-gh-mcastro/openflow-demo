import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/snowflake";

interface MapRow {
  COUNTRY_CODE: string;
  COUNTRY_NAME: string;
  VALUE: number;
}

const VALID_INDICATOR = /^[A-Z_]+$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const indicator = searchParams.get("indicator") || "";
    const year = parseInt(searchParams.get("year") || "2024", 10);

    if (!indicator || !VALID_INDICATOR.test(indicator)) {
      return NextResponse.json(
        { error: "Valid indicator is required" },
        { status: 400 }
      );
    }

    if (isNaN(year) || year < 1980 || year > 2030) {
      return NextResponse.json(
        { error: "Year must be between 1980 and 2030" },
        { status: 400 }
      );
    }

    const sql = `
      SELECT
        c.COUNTRY_CODE,
        c.COUNTRY_NAME,
        i.VALUE
      FROM API_DEMO.PUBLIC.IMF_DATAMAPPER_INDICATORS i
      JOIN API_DEMO.PUBLIC.COUNTRY_METADATA c ON i.COUNTRY_CODE = c.COUNTRY_CODE
      WHERE i.INDICATOR = '${indicator}'
        AND i.YEAR = ${year}
      ORDER BY c.COUNTRY_NAME
    `;

    const rows = await query<MapRow>(sql);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching map data:", error);
    return NextResponse.json(
      { error: "Failed to fetch map data" },
      { status: 500 }
    );
  }
}
