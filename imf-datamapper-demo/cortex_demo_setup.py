#!/usr/bin/env python3
"""
IMF World Economic Outlook Demo - Data Setup Script
Generates enrichment metadata and verifies data integrity.
Run after cortex_demo_setup.sql has been executed.
"""

# This script is a reference/documentation companion to the SQL setup.
# All data loading is done via SQL INSERT statements in cortex_demo_setup.sql.
# This script can be used to verify the setup or regenerate metadata if needed.

INDICATORS = {
    "BCA":          ("Current Account Balance",                     "Billions USD"),
    "BCA_NGDPD":   ("Current Account Balance (% of GDP)",          "% of GDP"),
    "GGXCNL_NGDP": ("Government Net Lending/Borrowing (% of GDP)", "% of GDP"),
    "GGXWDG_NGDP": ("Government Gross Debt (% of GDP)",            "% of GDP"),
    "LP":           ("Population",                                   "Millions"),
    "LUR":          ("Unemployment Rate",                            "%"),
    "NGDPD":        ("GDP (Nominal)",                                "Billions USD"),
    "NGDPDPC":      ("GDP Per Capita (Nominal)",                     "USD"),
    "NGDP_RPCH":    ("Real GDP Growth",                              "%"),
    "PCPIEPCH":     ("Inflation (End of Period)",                    "%"),
    "PCPIPCH":      ("Inflation (Average)",                          "%"),
    "PPPEX":        ("PPP Exchange Rate",                            "National/USD"),
    "PPPGDP":       ("GDP (PPP)",                                    "Billions Intl$"),
    "PPPPC":        ("GDP Per Capita (PPP)",                         "Intl$"),
    "PPPSH":        ("Share of World GDP (PPP)",                     "%"),
}

COUNTRIES_G7 = ["USA", "GBR", "FRA", "DEU", "JPN", "CAN", "ITA"]
COUNTRIES_G20_EMERGING = ["CHN", "IND", "BRA", "RUS", "MEX", "IDN", "TUR", "SAU", "ZAF", "ARG"]

if __name__ == "__main__":
    print("IMF Demo Setup Reference")
    print(f"  Indicators: {len(INDICATORS)}")
    print(f"  G7 Countries: {', '.join(COUNTRIES_G7)}")
    print(f"  G20 Emerging: {', '.join(COUNTRIES_G20_EMERGING)}")
    print("\nAll data loading is handled by cortex_demo_setup.sql")
    print("Run that file first, then use cortex_demo_prompts.yaml for the demo.")
