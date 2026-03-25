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

## Connecting to Postgres

### Prerequisites

- `psql` (PostgreSQL client) installed locally
- **VPN must be disconnected** — GlobalProtect and similar VPN clients intercept the TLS handshake on port 5432 and break the Postgres SSL negotiation, causing `SSL error: unexpected eof while reading`. Disconnect your VPN or request a split-tunnel exclusion for `*.postgres.snowflake.app`.

### Network Policy (allow external connections)

By default, Snowflake Postgres instances reject all incoming connections. Create a `POSTGRES_INGRESS` network rule to allow your IP:

```sql
-- Create ingress rule (replace with your IP or use 0.0.0.0/0 for testing)
CREATE NETWORK RULE API_DEMO.PUBLIC.BTC_POSTGRES_INGRESS_RULE
    TYPE = IPV4
    VALUE_LIST = ('<your_ip>/32')
    MODE = POSTGRES_INGRESS;

-- Create and attach network policy
CREATE NETWORK POLICY BTC_POSTGRES_POLICY
    ALLOWED_NETWORK_RULE_LIST = ('API_DEMO.PUBLIC.BTC_POSTGRES_INGRESS_RULE');

ALTER POSTGRES INSTANCE API_DEMO.PUBLIC.BTC_POSTGRES
    SET NETWORK_POLICY = 'BTC_POSTGRES_POLICY';
```

### Save Connection Locally

Add the instance to your PostgreSQL service file (`~/.pg_service.conf`):

```ini
[btc_postgres]
host=<your_postgres_host>.postgres.snowflake.app
port=5432
dbname=postgres
user=application
sslmode=require
```

Add the password to `~/.pgpass` (must have `chmod 600` permissions):

```
<your_postgres_host>.postgres.snowflake.app:5432:postgres:application:<your_password>
```

### Connect and Query

```bash
# Interactive session
psql "service=btc_postgres"

# Row count
psql "service=btc_postgres" -c "SELECT count(*) FROM flow1_cdc.btc_trades;"

# Latest trades
psql "service=btc_postgres" -c \
  "SELECT trade_id, side, price, size, time
   FROM flow1_cdc.btc_trades
   ORDER BY time DESC LIMIT 10;"

# Price summary
psql "service=btc_postgres" -c \
  "SELECT side,
          count(*) AS trades,
          round(min(price)::numeric, 2) AS min_price,
          round(avg(price)::numeric, 2) AS avg_price,
          round(max(price)::numeric, 2) AS max_price
   FROM flow1_cdc.btc_trades
   GROUP BY side;"
   
# Delete all values
psql "service=btc_postgres" -c \
  "TRUNCATE TABLE flow1_cdc.btc_trades;"
  
# Emptying aws s3 bucket
aws s3 rm s3://snowflake-mcastro/btc_trades/ --recursive --include "*.json" --profile mcastro-se-sandbox

# Checking uniqueids in aws s3
aws s3 cp s3://snowflake-mcastro/btc_trades/ /tmp/btc_count/ --recursive --include "*.json" --profile mcastro-se-sandbox && \python3 -c "import json, glob
ids = set()
for f in glob.glob('/tmp/btc_count/*.json'):
  for e in json.load(open(f)):
    ids.add(e['trade_id'])
print(f'Unique trade_ids: {len(ids)}')
"
```

### Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `SSL error: unexpected eof while reading` | VPN (GlobalProtect) intercepting TLS | Disconnect VPN or add split-tunnel exclusion for `*.postgres.snowflake.app` |
| `connection refused` | IP not in network policy | Add your IP to the `POSTGRES_INGRESS` rule |
| `password authentication failed` | Wrong password or user | Check `~/.pgpass` entry matches the instance credentials |
| `timeout` | Instance is suspended | Run `ALTER POSTGRES INSTANCE ... RESUME` in Snowflake |

## Verification

Once the flow is running, verify data is flowing:

1. **NiFi Bulletin Board** - No errors on any processor
2. **S3 Bucket** - JSON files appearing at `s3://<bucket>/btc_trades/YYYYMMDD-HHmmss.json`
3. **Postgres** - Connect via psql (see above) and run:
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
