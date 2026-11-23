import 'dotenv/config';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { createDatabase, resolveDatabaseUrl } from './client';

const here = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const { db, pool } = createDatabase(resolveDatabaseUrl());
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS unaccent`);
    await migrate(db, { migrationsFolder: path.join(here, '..', 'migrations') });
    // 补充 trigram 索引（drizzle-kit 不会为 gin_trgm_ops 生成 DDL）。
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS poets_name_trgm_idx ON poets USING gin (name gin_trgm_ops)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS poet_aliases_alias_trgm_idx ON poet_aliases USING gin (alias gin_trgm_ops)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS works_title_trgm_idx ON works USING gin (title gin_trgm_ops)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS works_text_trgm_idx ON works USING gin (text_normalized gin_trgm_ops)
    `);
    console.log('[migrate] 数据库迁移完成');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[migrate] 失败：', error);
  process.exitCode = 1;
});
