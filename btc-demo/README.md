# BTC Trades Ingestion Demo - Snowflake Openflow

Real-time Bitcoin trade ingestion pipeline built with [Snowflake Openflow](https://docs.snowflake.com/en/user-guide/data-integration/openflow), demonstrating API-to-Postgres-to-S3 data flow using Apache NiFi processors running on Snowpark Container Services (SPCS).

## Demo Recordings

| Recording | Description |
|-----------|-------------|
| `part1.mp4` | Infrastructure setup: Postgres instance, network rules, EAIs, flow import |
| `part2.mp4` | Flow configuration, debugging, and end-to-end data verification |

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────────────┐
│  Coinbase API    │     │  Split Trades    │     │  Snowflake Postgres      │
│  (InvokeHTTP)    │────▶│  (SplitJson)     │────▶│  (PutDatabaseRecord)     │
│  500 trades/60s  │     │  JSON → records  │     │  flow1_cdc.btc_trades    │
└──────────────────┘     └──────────────────┘     └───────────┬──────────────┘
                                                              │
                                                              ▼
                                                  ┌──────────────────────────┐
                                                  │  ExecuteSQLRecord        │
                                                  │  SELECT * FROM           │
                                                  │  flow1_cdc.btc_trades    │
                                                  └───────────┬──────────────┘
                                                              │
                                                              ▼
                                                  ┌──────────────────────────┐
                                                  │  PutS3Object             │
                                                  │  s3://snowflake-mcastro/ │
                                                  │  btc_trades/*.json       │
                                                  └──────────────────────────┘
```

## Data Source

The [Coinbase Exchange API](https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproducttrades) provides free, unauthenticated access to recent BTC-USD trades.

**Endpoint:** `https://api.exchange.coinbase.com/products/BTC-USD/trades?limit=500`

| Field | Type | Description |
|-------|------|-------------|
| `trade_id` | BIGINT | Unique trade identifier |
| `side` | VARCHAR(10) | Trade side (`buy` or `sell`) |
| `size` | NUMERIC(20,8) | Amount of BTC traded |
| `price` | NUMERIC(20,8) | Trade price in USD |
| `time` | TIMESTAMPTZ | Trade timestamp (ISO 8601) |

## Flow Files

| File | Description |
|------|-------------|
| `Flow_1_Source_-_API_to_Postgres.json` | NiFi flow definition for API → Postgres → S3 pipeline |
| `Flow_2_-_API_to_SF_and_PG.json` | NiFi flow definition for API → Postgres + Snowflake (Snowpipe Streaming) |

## Prerequisites

- A Snowflake account with Openflow enabled and a running runtime
- [Cortex Code CLI](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli) installed
- AWS credentials (long-lived AKIA* keys) with write access to the target S3 bucket

## Setup

### 1. Snowflake Postgres Instance

```sql
CREATE POSTGRES INSTANCE API_DEMO.PUBLIC.BTC_POSTGRES
    COMPUTE_FAMILY = 'STANDARD_M'
    STORAGE_SIZE_GB = 10
    AUTHENTICATION_AUTHORITY = 'POSTGRES'
    AUTO_SUSPEND_SECS = 3600;

-- Wait for READY state
SHOW POSTGRES INSTANCES;

-- Set the application password
ALTER POSTGRES INSTANCE API_DEMO.PUBLIC.BTC_POSTGRES
    SET APPLICATION_PASSWORD = '<your_password>';
```

Then connect to the Postgres instance and create the schema/table:

```sql
CREATE SCHEMA IF NOT EXISTS flow1_cdc;

CREATE TABLE IF NOT EXISTS flow1_cdc.btc_trades (
    trade_id BIGINT PRIMARY KEY,
    side VARCHAR(10),
    size NUMERIC(20,8),
    price NUMERIC(20,8),
    time TIMESTAMPTZ
);
```

### 2. Snowflake Database and Grants

```sql
CREATE DATABASE IF NOT EXISTS API_DEMO;

-- Network rules (ports are required for SPCS)
CREATE OR REPLACE NETWORK RULE API_DEMO.PUBLIC.COINBASE_API_NETWORK_RULE
    MODE = EGRESS TYPE = HOST_PORT
    VALUE_LIST = ('api.exchange.coinbase.com:443');

CREATE OR REPLACE NETWORK RULE API_DEMO.PUBLIC.POSTGRES_BTC_NETWORK_RULE
    MODE = EGRESS TYPE = HOST_PORT
    VALUE_LIST = ('<your_postgres_host>:5432');

CREATE OR REPLACE NETWORK RULE API_DEMO.PUBLIC.S3_BTC_NETWORK_RULE
    MODE = EGRESS TYPE = HOST_PORT
    VALUE_LIST = ('s3.<region>.amazonaws.com:443',
                  '<bucket>.s3.<region>.amazonaws.com:443',
                  'sts.amazonaws.com:443');

-- External Access Integrations
CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION COINBASE_API_ACCESS
    ALLOWED_NETWORK_RULES = (API_DEMO.PUBLIC.COINBASE_API_NETWORK_RULE)
    ENABLED = TRUE;

CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION POSTGRES_BTC_ACCESS
    ALLOWED_NETWORK_RULES = (API_DEMO.PUBLIC.POSTGRES_BTC_NETWORK_RULE)
    ENABLED = TRUE;

CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION S3_BTC_ACCESS
    ALLOWED_NETWORK_RULES = (API_DEMO.PUBLIC.S3_BTC_NETWORK_RULE)
    ENABLED = TRUE;

-- Grant EAIs to the Openflow runtime role
GRANT USAGE ON INTEGRATION COINBASE_API_ACCESS TO ROLE OPENFLOW_RUNTIME_ROLE;
GRANT USAGE ON INTEGRATION POSTGRES_BTC_ACCESS TO ROLE OPENFLOW_RUNTIME_ROLE;
GRANT USAGE ON INTEGRATION S3_BTC_ACCESS TO ROLE OPENFLOW_RUNTIME_ROLE;

-- Database/schema grants
GRANT USAGE ON DATABASE API_DEMO TO ROLE OPENFLOW_RUNTIME_ROLE;
GRANT USAGE ON SCHEMA API_DEMO.PUBLIC TO ROLE OPENFLOW_RUNTIME_ROLE;
GRANT CREATE SCHEMA ON DATABASE API_DEMO TO ROLE OPENFLOW_RUNTIME_ROLE;
GRANT CREATE TABLE ON SCHEMA API_DEMO.PUBLIC TO ROLE OPENFLOW_RUNTIME_ROLE;
```

### 3. Attach EAIs to the Openflow Runtime

In the Openflow Control Plane UI, attach all three EAIs to your runtime:
- `COINBASE_API_ACCESS`
- `POSTGRES_BTC_ACCESS`
- `S3_BTC_ACCESS`

### 4. Deploy the Flow

Use the Cortex Code CLI with the Openflow skill to import and configure the flow:

```
Deploy Flow_1_Source_-_API_to_Postgres.json to my Openflow runtime.
Configure the Postgres connection pool with my btc_postgres instance credentials
and upload the PostgreSQL JDBC driver as a parameter asset.
Set the AWS credentials on the AWSCredentialsProviderControllerService.
Start the flow.
```

## Key Configuration Details

These are important NiFi configuration details discovered during implementation:

| Item | Detail |
|------|--------|
| **JDBC Driver** | Must be uploaded as a parameter asset via `nipyapi ci upload_asset`, not a filesystem path |
| **JDBC URL** | Must include `stringtype=unspecified` for Postgres TIMESTAMPTZ columns to accept ISO 8601 strings |
| **Network Rules** | Must include explicit port numbers (e.g., `:5432`, `:443`) or SPCS gets `SocketTimeoutException` |
| **Statement Type** | Use `UPSERT` with `Update Keys: trade_id` since the API returns overlapping trades across fetches |
| **AWS Credentials** | NiFi's `AWSCredentialsProviderControllerService` does not support `Session Token` - use long-lived AKIA* keys |
| **S3 Region** | Must match the actual bucket region (check with `aws s3api get-bucket-location`) |

## Verification

Once the flow is running, verify data is flowing:

1. **NiFi Bulletin Board** - No errors on any processor
2. **S3 Bucket** - JSON files appearing at `s3://<bucket>/btc_trades/YYYYMMDD-HHmmss.json`
3. **Postgres** - Connect to the instance and run:
   ```sql
   SELECT COUNT(*) FROM flow1_cdc.btc_trades;
   SELECT * FROM flow1_cdc.btc_trades ORDER BY trade_id DESC LIMIT 10;
   ```

## References

- [Snowflake Openflow](https://docs.snowflake.com/en/user-guide/data-integration/openflow)
- [Snowflake Postgres](https://docs.snowflake.com/en/user-guide/postgres)
- [Cortex Code CLI](https://docs.snowflake.com/en/user-guide/cortex-code/cortex-code-cli)
- [NiPyApi](https://nipyapi.readthedocs.io/)
- [Coinbase Exchange API](https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproducttrades)
