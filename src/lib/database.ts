import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

// Database connection pool
let pool: Pool | null = null;

/**
 * Get or create a PostgreSQL connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
      query_timeout: 10000, // Query timeout in milliseconds
      statement_timeout: 10000, // Statement timeout in milliseconds
    });

    // Handle pool errors
    pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err);
    });

    // Log successful connection
    pool.on("connect", () => {
      console.log("Connected to PostgreSQL database");
    });
  }

  return pool;
}

/**
 * Execute a query with parameters
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: (string | number | boolean | null)[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    // Log slow queries (over 100ms)
    if (duration > 100) {
      console.log("Slow query executed:", {
        text,
        duration: `${duration}ms`,
        rows: result.rowCount,
      });
    }

    return result;
  } catch (error) {
    console.error("Database query error:", {
      text,
      params,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return await pool.connect();
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query("SELECT NOW() as current_time");
    console.log("Database connection test successful:", result.rows[0]);
    return true;
  } catch (error) {
    console.error("Database connection test failed:", error);
    return false;
  }
}

/**
 * Close all database connections
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("Database pool closed");
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  await closePool();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closePool();
  process.exit(0);
});
