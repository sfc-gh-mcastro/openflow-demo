import { NextResponse } from "next/server";
import { query } from "@/lib/snowflake";

interface IndicatorRow {
  INDICATOR: string;
  INDICATOR_NAME: string;
  UNIT: string;
  DESCRIPTION: string;
}

export async function GET() {
  try {
    const rows = await query<IndicatorRow>(
      `SELECT INDICATOR, INDICATOR_NAME, UNIT, DESCRIPTION
       FROM API_DEMO.PUBLIC.INDICATOR_METADATA
       ORDER BY INDICATOR_NAME`
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching indicators:", error);
    return NextResponse.json(
      { error: "Failed to fetch indicators" },
      { status: 500 }
    );
  }
}
