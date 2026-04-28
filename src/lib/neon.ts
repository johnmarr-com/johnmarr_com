import { Pool } from "pg";

let pool: Pool | null = null;

/**
 * Single shared NEON connection pool. Lazy-initialized to keep cold start light.
 * Server-only — never import in client code.
 */
export function getNeonPool(): Pool {
  if (pool) return pool;
  const url = process.env["NEON_URL"];
  if (!url) throw new Error("NEON_URL missing from environment");
  pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
  });
  return pool;
}
