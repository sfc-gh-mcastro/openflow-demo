import { NextResponse } from "next/server";
import { query } from "@/lib/snowflake";

interface CountryRow {
  COUNTRY_CODE: string;
  COUNTRY_NAME: string;
  REGION: string;
  INCOME_GROUP: string;
  IS_G7: boolean;
  IS_G20: boolean;
  IS_EMERGING: boolean;
}

export async function GET() {
  try {
    const rows = await query<CountryRow>(
      `SELECT COUNTRY_CODE, COUNTRY_NAME, REGION, INCOME_GROUP, IS_G7, IS_G20, IS_EMERGING
       FROM API_DEMO.PUBLIC.COUNTRY_METADATA
       ORDER BY COUNTRY_NAME`
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching countries:", error);
    return NextResponse.json(
      { error: "Failed to fetch countries" },
      { status: 500 }
    );
  }
}
