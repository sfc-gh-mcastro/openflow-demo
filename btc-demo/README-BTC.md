# BTC Trades Demo

An Openflow demo that ingests real-time Bitcoin trade data from the [Coinbase Exchange API](https://api.exchange.coinbase.com/products/BTC-USD/trades) and writes it to Snowflake Postgres and Snowflake via Snowpipe Streaming.

## Data Source

The [Coinbase Exchange API](https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproducttrades) provides free, public access to recent trade data for cryptocurrency trading pairs. This demo fetches the latest 500 BTC-USD trades every 60 seconds.

### Trade Fields

| Field | Description |
|-------|-------------|
| trade_id | Unique trade identifier |
| side | Trade side (`buy` or `sell`) |
| size | Amount of BTC traded |
| price | Trade price in USD |
| time | Trade timestamp (ISO 8601) |

## Architecture

The demo includes two Openflow flows:

| Flow | File | Description |
|------|------|-------------|
| Flow 1 | `Flow_1_Source_-_API_to_Postgres.json` | API -> Snowflake Postgres -> S3 (JSON export) |
| Flow 2 | `Flow_2_-_API_to_SF_and_PG.json` | API -> Snowflake Postgres + Snowflake (Snowpipe Streaming) |

### Flow 1: API to Postgres

1. **Fetch BTC Trades** (InvokeHTTP) -- Calls the Coinbase API every 60 seconds to fetch the latest 500 trades.
2. **Split Trades Array** (SplitJson) -- Splits the JSON array into individual trade records.
3. **Write to Postgres** (PutDatabaseRecord) -- Inserts each trade into the `flow1_cdc.btc_trades` table in Snowflake Postgres.
4. **ExecuteSQLRecord** -- Reads back the full table and outputs it as JSON.
5. **PutS3Object** -- Writes the JSON export to S3 at `s3://snowflake-mcastro/btc_trades/` (using the `se-sandbox` AWS profile).

### Flow 2: API to Snowflake and Postgres

1. **Fetch BTC Trades** (InvokeHTTP) -- Same Coinbase API call as Flow 1.
2. **Split Trades Array** (SplitJson) -- Splits the JSON array into individual trade records.
3. **PutDatabaseRecord** -- Inserts trades into Snowflake Postgres (`flow1_cdc.btc_trades`).
4. **PutSnowpipeStreaming** -- Streams trades directly into a Snowflake table via Snowpipe Streaming.

## Snowflake Postgres Setup

The flows write trade data to a Snowflake Postgres instance as the intermediate CDC store. Create the instance, schema, and table before deploying.

### Create the Snowflake Postgres instance

```sql
CREATE POSTGRES INSTANCE btc_postgres
    WAREHOUSE = '<your_warehouse>'
    AUTO_SUSPEND_SECS = 3600;
```

Once the instance is running, connect to it and create the schema and table:

```sql
-- Connect to the Postgres instance and run:
CREATE SCHEMA IF NOT EXISTS flow1_cdc;

CREATE TABLE IF NOT EXISTS flow1_cdc.btc_trades (
    trade_id BIGINT,
    side VARCHAR(4),
    size NUMERIC,
    price NUMERIC,
    time TIMESTAMPTZ
);
```

Note the instance's connection hostname (shown in `DESCRIBE POSTGRES INSTANCE btc_postgres`) -- you will need it when configuring the Postgres Connection Pool controller service in the Openflow flow.

## Snowflake Setup

Before deploying the Openflow flows, create the target resources and grant the necessary permissions to the Openflow runtime role.

### Create the database and table

```sql
CREATE DATABASE IF NOT EXISTS API_DEMO;
USE DATABASE API_DEMO;

CREATE OR REPLACE TABLE API_DEMO.PUBLIC.BTC_TRADES (
    TRADE_ID NUMBER,
    SIDE VARCHAR,
    SIZE FLOAT,
    PRICE FLOAT,
    TIME TIMESTAMP_NTZ(9)
);
```

### Create external access integration

```sql
CREATE OR REPLACE NETWORK RULE COINBASE_API_NETWORK_RULE
    MODE = EGRESS
    TYPE = HOST_PORT
    VALUE_LIST = ('api.exchange.coinbase.com');

CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION COINBASE_API_ACCESS
    ALLOWED_NETWORK_RULES = (COINBASE_API_NETWORK_RULE)
    ENABLED = TRUE;

GRANT USAGE ON INTEGRATION COINBASE_API_ACCESS TO ROLE "OPENFLOW_RUNTIME_ROLE";
```

### Grant permissions to the Openflow runtime role

The `OPENFLOW_RUNTIME_ROLE` requires USAGE on the database and schema, CREATE TABLE on the schema, and read/write privileges on the table:

```sql
-- Database grants
GRANT USAGE ON DATABASE API_DEMO TO ROLE OPENFLOW_RUNTIME_ROLE;
GRANT CREATE SCHEMA ON DATABASE API_DEMO TO ROLE OPENFLOW_RUNTIME_ROLE;

-- Schema grants
GRANT USAGE ON SCHEMA API_DEMO.PUBLIC TO ROLE OPENFLOW_RUNTIME_ROLE;
GRANT CREATE TABLE ON SCHEMA API_DEMO.PUBLIC TO ROLE OPENFLOW_RUNTIME_ROLE;

-- Table grants
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, REBUILD, EVOLVE SCHEMA, APPLYBUDGET
    ON TABLE API_DEMO.PUBLIC.BTC_TRADES
    TO ROLE OPENFLOW_RUNTIME_ROLE;
```

## Getting Started with Cortex Code CLI

The [Cortex Code CLI](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli) is required to deploy this demo. The CLI has built-in Openflow skills that know how to deploy flows, manage the Openflow runtime, and interact with the NiFi REST API via [NiPyApi](https://nipyapi.readthedocs.io/).

### Prerequisites

1. Install the Cortex Code CLI following the [installation guide](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli).
2. An Openflow runtime must already be provisioned and active in your Snowflake account.
3. Complete the [Snowflake Postgres Setup](#snowflake-postgres-setup) steps above to create the Postgres instance, schema, and `btc_trades` table.
4. Complete the [Snowflake Setup](#snowflake-setup) steps above to create the database, table, external access integration, and role grants.
5. This project includes a uv environment with NiPyApi pre-configured. Install the dependencies:

```bash
uv sync
```

### Deploy and run

Open the Cortex Code CLI from this project directory and use the following prompt to validate your setup and deploy the flow:

```
Deploy and run the BTC Trades demo:

1. Read your Openflow skills so you know how to interact
   with flows and the Openflow runtime.
2. Verify that my Openflow runtime exists and is active.
3. Check that the following all exist: the API_DEMO
   database, the BTC_TRADES table, and the
   COINBASE_API_ACCESS external access integration. If
   anything is missing, follow the Snowflake Setup section
   in the README to create it. If you are unable to
   complete any prerequisite, state what failed and stop.
4. Use the project's Python virtual environment (.venv)
   for all nipyapi operations via Python, not the CLI.
5. Deploy the Flow_1_Source_-_API_to_Postgres.json flow
   to my Openflow runtime and start it.
6. Wait for the flow to process data. Poll every 10
   seconds and wait until the process group has processed
   data. Only then stop the flow.
7. Verify the data loaded by querying the Postgres table
   to list the 10 most recent BTC trades by timestamp.
```

### Documentation

- [Cortex Code CLI](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli)
- [Openflow](https://docs.snowflake.com/en/user-guide/data-integration/openflow)
- [NiPyApi](https://nipyapi.readthedocs.io/)
- [Apache NiFi REST API](https://nifi.apache.org/docs/nifi-docs/rest-api/index.html)
- [Coinbase Exchange API](https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproducttrades)
