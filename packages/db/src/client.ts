import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

export type Database = ReturnType<typeof createDatabase>['db'];

export const DEFAULT_DATABASE_URL = 'postgresql://localhost:5432/shihe';

export function resolveDatabaseUrl(url?: string): string {
  return url ?? process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

/**
 * 创建数据库连接池。Next.js 开发环境会反复执行模块，
 * 因此单例缓存挂在 globalThis 上，避免连接泄漏。
 */
export function createDatabase(url?: string) {
  const pool = new Pool({
    connectionString: resolveDatabaseUrl(url),
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

const globalForDb = globalThis as unknown as {
  __shiheDb?: Database;
  __shihePool?: Pool;
};

export function getDatabase(): Database {
  if (!globalForDb.__shiheDb) {
    const { db, pool } = createDatabase();
    globalForDb.__shiheDb = db;
    globalForDb.__shihePool = pool;
  }
  return globalForDb.__shiheDb;
}

export function getPool(): Pool {
  getDatabase();
  return globalForDb.__shihePool as Pool;
}
