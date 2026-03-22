# IMF DataMapper Demo — End-to-End Walkthrough

This document describes the complete demo built with **Cortex Code CLI** on top of IMF World Economic Outlook data in Snowflake. The demo includes two artifacts:

1. **IMF Economic Explorer** — A Next.js/React web application with interactive charts and a world map choropleth
2. **Snowflake Intelligence Agent** — A Cortex Agent backed by a Semantic View, accessible through Snowflake Intelligence for natural-language economic queries

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Data Model](#data-model)
- [Snowflake Setup](#snowflake-setup)
- [Artifact 1: React Application (IMF Explorer)](#artifact-1-react-application-imf-explorer)
  - [Prerequisites](#prerequisites)
  - [Configuration](#configuration)
  - [Running the App](#running-the-app)
  - [Application Features](#application-features)
  - [Project Structure](#project-structure)
  - [API Endpoints](#api-endpoints)
- [Artifact 2: Snowflake Intelligence Agent](#artifact-2-snowflake-intelligence-agent)
  - [Semantic View](#semantic-view)
  - [Cortex Agent](#cortex-agent)
  - [Using the Agent in Snowflake Intelligence](#using-the-agent-in-snowflake-intelligence)
  - [Sample Questions](#sample-questions)
- [Demo Script (Cortex Code Prompts)](#demo-script-cortex-code-prompts)
- [How It Was Built](#how-it-was-built)

---

## Architecture Overview

```
                    +--------------------------+
                    |   IMF DataMapper API     |
                    |  (imf.org/datamapper)    |
                    +-------------|------------+
                                  | Openflow ingestion
                                  v
                    +-----------------------------+
                    |        Snowflake            |
                    |  Database: API_DEMO.PUBLIC  |
                    |                             |
                    |  IMF_DATAMAPPER_INDICATORS  |  <-- 147,392 rows (fact)
                    |  COUNTRY_METADATA           |  <-- 60 rows (dimension)
                    |  INDICATOR_METADATA         |  <-- 15 rows (dimension)
                    |                             |
                    |  IMF_ECONOMIC_OUTLOOK       |  <-- Semantic View
                    |  IMF_ECONOMIC_AGENT         |  <-- Cortex Agent
                    +---------|------------|------+
                              |            |
              +---------------+            +----------------+
              |                                             |
              v                                             v
    +--------------------+                    +----------------------------+
    | React App          |                    | Snowflake Intelligence     |
    | (Next.js 16)       |                    | Natural-language queries   |
    | - Charts (Recharts)|                    | via Cortex Agent           |
    | - World Map        |                    +----------------------------+
    | - Data Table       |
    +--------------------+
```

---

## Data Model

The data follows a **star schema** with one fact table and two dimension tables.

### Fact Table: `IMF_DATAMAPPER_INDICATORS`

| Column | Type | Description |
|--------|------|-------------|
| INDICATOR | VARCHAR | IMF indicator code (e.g., `NGDPD`, `LUR`) |
| COUNTRY_CODE | VARCHAR | ISO Alpha-3 country code (e.g., `USA`, `DEU`) |
| YEAR | NUMBER | Year (1980–2030; 2024–2030 are IMF projections) |
| VALUE | FLOAT | Indicator value |
| INGESTION_TIMESTAMP | TIMESTAMP_NTZ | When the row was ingested |

**Volume**: ~147,392 rows (15 indicators x 229 countries x ~51 years)

### Dimension Table: `COUNTRY_METADATA`

| Column | Type | Description |
|--------|------|-------------|
| COUNTRY_CODE | VARCHAR | ISO Alpha-3 code |
| COUNTRY_NAME | VARCHAR | Full country name |
| REGION | VARCHAR | Geographic region (Europe, Asia Pacific, etc.) |
| INCOME_GROUP | VARCHAR | World Bank income classification |
| IS_G7 | BOOLEAN | G7 member flag |
| IS_G20 | BOOLEAN | G20 member flag |
| IS_EMERGING | BOOLEAN | Emerging market flag |

**Volume**: 60 countries covering G7, G20, and major emerging/advanced economies.

### Dimension Table: `INDICATOR_METADATA`

| Column | Type | Description |
|--------|------|-------------|
| INDICATOR | VARCHAR | IMF indicator code |
| INDICATOR_NAME | VARCHAR | Human-readable name |
| UNIT | VARCHAR | Unit of measurement |
| DESCRIPTION | VARCHAR | Detailed description |

**Indicators available** (15 total):

| Code | Name | Unit |
|------|------|------|
| NGDPD | GDP (Nominal) | Billions USD |
| NGDP_RPCH | Real GDP Growth | % |
| NGDPDPC | GDP Per Capita (Nominal) | USD |
| PPPGDP | GDP (PPP) | Billions Intl$ |
| PPPPC | GDP Per Capita (PPP) | Intl$ |
| PPPSH | Share of World GDP (PPP) | % |
| PPPEX | PPP Exchange Rate | National/USD |
| PCPIPCH | Inflation (Average) | % |
| PCPIEPCH | Inflation (End of Period) | % |
| LUR | Unemployment Rate | % |
| GGXWDG_NGDP | Government Gross Debt (% of GDP) | % of GDP |
| GGXCNL_NGDP | Government Net Lending/Borrowing (% of GDP) | % of GDP |
| BCA | Current Account Balance | Billions USD |
| BCA_NGDPD | Current Account Balance (% of GDP) | % of GDP |
| LP | Population | Millions |

---

## Snowflake Setup

Run the SQL setup script to create the dimension tables and verify data:

```bash
# From the project root
snowsql -f cortex_demo_setup.sql
# Or execute in Snowsight / a Snowflake worksheet
```

The script (`cortex_demo_setup.sql`) is **idempotent** — it uses `CREATE OR REPLACE` and can be re-run safely. It:

1. Creates `INDICATOR_METADATA` (15 rows with indicator names, units, descriptions)
2. Creates `COUNTRY_METADATA` (60 rows with country names, regions, income groups, G7/G20/emerging flags)
3. Runs a verification query to confirm row counts across all three tables

> **Note**: The fact table `IMF_DATAMAPPER_INDICATORS` is populated separately via the Openflow ingestion pipeline (see the main `README.md` for Openflow deployment instructions).

---

## Artifact 1: React Application (IMF Explorer)

A full-featured Next.js web application that connects directly to Snowflake and provides interactive visualizations of IMF economic data.

### Prerequisites

- **Node.js** >= 18
- **npm** (comes with Node.js)
- A **Snowflake account** with the `API_DEMO` database populated
- A **key-pair** for Snowflake authentication (PKCS8 PEM format)

### Configuration

Create an `.env.local` file inside the `imf-explorer/` directory:

```env
SNOWFLAKE_ACCOUNT=<your-account-locator>
SNOWFLAKE_USER=<your-username>
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_DATABASE=API_DEMO
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_PRIVATE_KEY_PATH=~/.ssh/<your_private_key>.p8
```

The app supports three authentication methods (in priority order):
1. **SPCS OAuth token** — Automatically detected when running inside Snowpark Container Services
2. **Key-pair (JWT)** — Uses `SNOWFLAKE_PRIVATE_KEY_PATH` pointing to a PKCS8 PEM private key
3. **External browser** — Fallback for interactive login

### Running the App

```bash
cd imf-explorer

# Install dependencies
npm install --legacy-peer-deps

# Start the development server
npm run dev
```

The app will be available at `http://localhost:3000`.

> **Note**: The `--legacy-peer-deps` flag is required because `react-simple-maps` (the world map library) has not yet updated its peer dependency declaration for React 19.

### Application Features

#### Landing Page — World Map Choropleth
When the app loads, it displays an interactive **world map** showing the selected indicator for a given year. Users can:
- Switch between any of the 15 IMF indicators via a dropdown
- Navigate years (1980–2030) with increment/decrement buttons or direct input
- Hover over countries to see tooltips with exact values
- Zoom and pan the map

Countries are color-coded using IMF-style color scales:
- **Red → Yellow → Green** for percentage indicators (GDP growth, inflation, etc.)
- **Light blue → Dark blue** for absolute values (GDP in billions, per capita, population)
- **Gray** for countries with no data

#### Sidebar Controls
The left sidebar provides:
- **Country selector** — Multi-select with quick-filter buttons for G7, G20, Emerging Markets, and by region
- **Indicator selector** — Multi-select from all 15 IMF indicators
- **Year range selector** — Adjustable range from 1980 to 2030
- **Compare button** — Fetches the selected data from Snowflake

#### Comparison View (after clicking Compare)
Three tabs are available:
- **Charts** — One line chart per indicator, with a separate series for each selected country (powered by Recharts)
- **Map** — The same world map choropleth, useful for geographic comparison
- **Data** — A sortable data table with all raw values

### Project Structure

```
imf-explorer/
├── .env.local                      # Snowflake connection credentials
├── package.json                    # Dependencies (Next.js 16, React 19, etc.)
├── app/
│   ├── page.tsx                    # Main application page
│   ├── layout.tsx                  # Root layout with fonts and metadata
│   └── api/
│       ├── countries/route.ts      # GET /api/countries — fetch country metadata
│       ├── indicators/route.ts     # GET /api/indicators — fetch indicator metadata
│       ├── compare/route.ts        # GET /api/compare — multi-country/indicator query
│       └── map/route.ts            # GET /api/map — single indicator, all countries
├── components/
│   ├── world-map.tsx               # Choropleth map (react-simple-maps)
│   ├── comparison-chart.tsx        # Line charts (Recharts)
│   ├── country-selector.tsx        # Country multi-select with group filters
│   ├── indicator-selector.tsx      # Indicator multi-select
│   ├── year-range-selector.tsx     # Year range slider
│   ├── data-table.tsx              # Sortable data table
│   └── ui/                         # shadcn/ui primitives (Button, Card, etc.)
├── lib/
│   └── snowflake.ts                # Snowflake SDK connection (JWT/OAuth/browser)
└── public/                         # Static assets
```

### API Endpoints

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/countries` | GET | — | Returns all 60 countries with metadata |
| `/api/indicators` | GET | — | Returns all 15 indicators with names/units |
| `/api/compare` | GET | `countries`, `indicators`, `startYear`, `endYear` | Multi-country, multi-indicator time series |
| `/api/map` | GET | `indicator`, `year` | Single indicator values for all countries (for the choropleth) |

### Key Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| next | 16.2.1 | React framework with API routes (Turbopack) |
| react | 19.2.4 | UI library |
| snowflake-sdk | ^2.3.5 | Snowflake Node.js driver (key-pair JWT auth) |
| recharts | ^2.15.4 | Line charts for time series comparison |
| react-simple-maps | ^3.0.0 | SVG world map with TopoJSON rendering |
| shadcn (via @base-ui/react) | ^4.1.0 | UI component library (Card, Select, Tabs, etc.) |
| lucide-react | ^0.577.0 | Icons |

---

## Artifact 2: Snowflake Intelligence Agent

### Semantic View

A **Semantic View** (`API_DEMO.PUBLIC.IMF_ECONOMIC_OUTLOOK`) was created over the IMF data, joining the fact and dimension tables. It provides a business-friendly interface for Cortex Analyst to generate SQL from natural language questions.

The semantic view defines:
- **Dimensions**: Country name, code, region, income group, G7/G20/emerging flags, indicator name, code, unit, year
- **Measures**: Indicator value
- **Relationships**: Joins between the fact table and both dimension tables

### Cortex Agent

A **Cortex Agent** (`API_DEMO.PUBLIC.IMF_ECONOMIC_AGENT`) was built on top of the semantic view. The agent is configured with:

- **Orchestration model**: Auto (Snowflake selects the best model)
- **Tool**: `cortex_analyst_text_to_sql` connected to the `IMF_ECONOMIC_OUTLOOK` semantic view
- **Instructions**: Detailed system prompt covering:
  - Domain knowledge about all 15 IMF indicators
  - Data coverage (60 countries, 1980–2030, historical vs. projection years)
  - Response formatting guidelines (tables for comparisons, units with numbers, rankings ordered by value)
  - Boundaries (no real-time market data, no custom forecasts beyond IMF projections)

The agent spec is stored at:
```
API_DEMO_PUBLIC_IMF_ECONOMIC_AGENT/versions/v20260321-1002/agent_spec.json
```

### Using the Agent in Snowflake Intelligence

1. Navigate to **Snowflake Intelligence** in Snowsight
2. Find the **IMF Economic Agent** (or **World Economy Agent**)
3. Ask natural-language questions about global economics — the agent translates them to SQL via the semantic view

### Sample Questions

- "What is India's GDP growth forecast from 2024 to 2030?"
- "Compare unemployment rates across European countries in 2024"
- "What are the top 10 economies by nominal GDP in 2025?"
- "Show GDP growth, inflation, and unemployment for G7 countries"
- "Which emerging market economies have the highest government debt as % of GDP?"
- "How does China's share of world GDP compare to the US over the last decade?"
- "Which countries are projected to overtake current top-10 GDP rankings by 2030?"

---

## Demo Script (Cortex Code Prompts)

The file `cortex_demo_prompts.yaml` contains the sequence of prompts used to build this entire demo with Cortex Code CLI:

```yaml
prompts:
  - What tables do we have in API_DEMO.PUBLIC? Describe the IMF data and enrichment tables.
  - Using AI_COMPLETE, generate a brief economic outlook summary for the G7 countries
    based on their 2024-2030 GDP growth and inflation projections.
  - Create a semantic view over the IMF economic data so analysts can ask questions
    like "What is India's GDP forecast?" or "Compare unemployment rates across Europe".
  - Build a Cortex Agent that uses the semantic view to answer natural language
    questions about the world economy.
  - Make this agent available in Snowflake Intelligence.
  - Build a React app that lets users select countries and compare economic indicators
    like GDP growth, inflation, and unemployment over time using charts.
  - Which emerging market economies are projected to overtake current top-10 GDP
    rankings by 2030?
```

To replay the demo, open Cortex Code CLI in this directory and enter each prompt in sequence.

---

## How It Was Built

This entire demo was built in a single session using **Cortex Code CLI** (codename: CoCo), Snowflake's AI-powered development assistant. The build process followed these steps:

1. **Data exploration** — Cortex Code queried the existing `IMF_DATAMAPPER_INDICATORS` table (ingested via Openflow) to understand the data shape, indicators, and country coverage.

2. **Metadata enrichment** — Generated and executed `cortex_demo_setup.sql` to create the `INDICATOR_METADATA` and `COUNTRY_METADATA` dimension tables with human-readable names, regions, income groups, and economic groupings (G7, G20, emerging markets).

3. **AI-powered analysis** — Used Snowflake's `AI_COMPLETE` function to generate an economic outlook summary from the raw data.

4. **Semantic View creation** — Built a semantic view (`IMF_ECONOMIC_OUTLOOK`) that joins the three tables, enabling Cortex Analyst to translate natural language to SQL.

5. **Cortex Agent setup** — Created and optimized a Cortex Agent (`IMF_ECONOMIC_AGENT`) with detailed instructions for economic analysis, connected to the semantic view via the `cortex_analyst_text_to_sql` tool.

6. **Snowflake Intelligence integration** — Published the agent to Snowflake Intelligence for organization-wide natural-language access.

7. **React application** — Scaffolded a Next.js 16 app with:
   - Snowflake Node.js SDK connection using key-pair JWT authentication
   - Four API routes for countries, indicators, comparison data, and map data
   - Interactive UI with country/indicator selectors, year range controls
   - Recharts line charts for time-series comparison
   - Sortable data tables
   - shadcn/ui component library for clean, professional styling

8. **World map choropleth** — Added an interactive world map using `react-simple-maps` with:
   - IMF-style color scales (red-yellow-green for percentages, blue gradients for absolute values)
   - Indicator and year selection controls
   - Hover tooltips with formatted values
   - Color legend with threshold labels
   - ISO numeric-to-Alpha3 code mapping (required because the TopoJSON world data uses ISO 3166-1 numeric codes while Snowflake data uses Alpha-3 codes)

9. **Testing and verification** — Used Playwright MCP browser automation to visually verify the world map rendering, confirming countries are properly colored based on data values.
