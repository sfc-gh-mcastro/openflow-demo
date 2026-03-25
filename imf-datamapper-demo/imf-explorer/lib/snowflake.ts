import snowflake from "snowflake-sdk";
import fs from "fs";

snowflake.configure({ logLevel: "ERROR" });

let connection: snowflake.Connection | null = null;
let cachedToken: string | null = null;

function getOAuthToken(): string | null {
  const tokenPath = "/snowflake/session/token";
  try {
    if (fs.existsSync(tokenPath)) {
      return fs.readFileSync(tokenPath, "utf8");
    }
  } catch {
    // Not in SPCS environment
  }
  return null;
}

function getPrivateKeyPem(): string | null {
  const keyPath = process.env.SNOWFLAKE_PRIVATE_KEY_PATH;
  if (!keyPath) return null;
  try {
    const resolved = keyPath.startsWith("~")
      ? keyPath.replace("~", process.env.HOME || "")
      : keyPath;
    return fs.readFileSync(resolved, "utf8");
  } catch (err) {
    console.error("Failed to load private key:", (err as Error).message);
    return null;
  }
}

function getConfig(): snowflake.ConnectionOptions {
  const base = {
    account: process.env.SNOWFLAKE_ACCOUNT || "",
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || "COMPUTE_WH",
    database: process.env.SNOWFLAKE_DATABASE || "API_DEMO",
    schema: process.env.SNOWFLAKE_SCHEMA || "PUBLIC",
  };

  // 1. SPCS OAuth token
  const token = getOAuthToken();
  if (token) {
    return {
      ...base,
      host: process.env.SNOWFLAKE_HOST,
      token,
      authenticator: "oauth",
    };
  }

  // 2. Key-pair authentication
  const privateKeyPem = getPrivateKeyPem();
  if (privateKeyPem) {
    return {
      ...base,
      username: process.env.SNOWFLAKE_USER || "",
      authenticator: "SNOWFLAKE_JWT",
      privateKey: privateKeyPem,
    };
  }

  // 3. Fallback to external browser
  return {
    ...base,
    username: process.env.SNOWFLAKE_USER || "",
    authenticator: "EXTERNALBROWSER",
  };
}

async function getConnection(): Promise<snowflake.Connection> {
  const token = getOAuthToken();

  if (connection && (!token || token === cachedToken)) {
    return connection;
  }

  if (connection) {
    console.log("OAuth token changed, reconnecting");
    connection.destroy(() => {});
  }

  const config = getConfig();
  const authMethod = token
    ? "OAuth token"
    : config.authenticator === "SNOWFLAKE_JWT"
      ? "key-pair (JWT)"
      : "external browser";
  console.log(`Connecting with ${authMethod}`);
  const conn = snowflake.createConnection(config);
  await conn.connectAsync(() => {});
  connection = conn;
  cachedToken = token;
  return connection;
}

function isRetryableError(err: unknown): boolean {
  const error = err as { message?: string; code?: number };
  return !!(
    error.message?.includes("OAuth access token expired") ||
    error.message?.includes("terminated connection") ||
    error.code === 407002
  );
}

export async function query<T>(sql: string, retries = 1): Promise<T[]> {
  try {
    const conn = await getConnection();
    return await new Promise<T[]>((resolve, reject) => {
      conn.execute({
        sqlText: sql,
        complete: (err, _stmt, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve((rows || []) as T[]);
          }
        },
      });
    });
  } catch (err) {
    console.error("Query error:", (err as Error).message);
    if (retries > 0 && isRetryableError(err)) {
      connection = null;
      return query(sql, retries - 1);
    }
    throw err;
  }
}
