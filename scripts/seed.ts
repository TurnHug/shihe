import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { CuratedDataset } from '@shihe/domain';
import { createDatabase } from '../packages/db/src/client';
import { ingestDataset } from '../packages/db/src/ingest';

const ROOT = path.resolve(import.meta.dirname, '..');

async function main(): Promise<void> {
  const datasetPath = path.join(ROOT, 'data', 'curated', 'dataset.json');
  console.log(`[seed] 读取 ${path.relative(ROOT, datasetPath)}`);
  const dataset = JSON.parse(await readFile(datasetPath, 'utf8')) as CuratedDataset;

  const { db, pool } = createDatabase();
  try {
    console.log(
      `[seed] 导入版本 ${dataset.version}：${dataset.poets.length} 位诗人 / ${dataset.works.length} 首作品 / ${dataset.sources.length} 个来源`,
    );
    const started = Date.now();
    await ingestDataset(db, dataset);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    const check = await pool.query<{ poets: string; works: string }>(`
      SELECT
        (SELECT COUNT(*) FROM poets WHERE publish_status = 'published') AS poets,
        (SELECT COUNT(*) FROM works WHERE publish_status = 'published' AND rights_status = 'cleared') AS works
    `);
    const row = check.rows[0];
    console.log(`[seed] 完成（${seconds}s）：诗人 ${row?.poets}，作品 ${row?.works}`);

    const sample = await pool.query<{ name: string; dynasty_label: string; total: string }>(`
      SELECT p.name, p.dynasty_label, COUNT(w.id) AS total
      FROM poets p LEFT JOIN works w
        ON w.poet_id = p.id AND w.publish_status = 'published' AND w.rights_status = 'cleared'
      GROUP BY p.id
      ORDER BY total DESC
      LIMIT 5
    `);
    console.log(
      '[seed] 收录作品数前五：',
      sample.rows.map((r) => `${r.name}(${r.total})`).join('、'),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[seed] 失败：', error);
  process.exitCode = 1;
});
