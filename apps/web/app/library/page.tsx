import type { Metadata } from 'next';
import Link from 'next/link';

import { SITE_NAME } from '@shihe/domain';
import type { CorpusImportStats } from '@shihe/domain';
import { getCorpusImportStats, getPublicStats } from '@shihe/db/server';

import { PageHeader, SiteFooter, StaticBackdrop } from '@/components/common/PageChrome';
import { withBasePath } from '@/lib/base-path';

import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '全库语料',
  description:
    '诗河全库语料说明：chinese-poetry、Werneror/Poetry 与 open-chinese/poetry-collection 三源的清洗、去重、导入统计与使用边界。',
  alternates: { canonical: '/library' },
};

export default async function LibraryPage() {
  const [stats, corpusStats] = await Promise.all([getPublicStats(), getCorpusImportStats()]);
  const corpus = corpusStats as unknown as CorpusImportStats | null;

  return (
    <>
      <StaticBackdrop />
      <PageHeader current={null} />
      <main id="main-content" className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.overline}>LIBRARY · 全库语料</p>
          <h1 className={styles.title}>星图之外，还有一片诗海。</h1>
          <p className={styles.lead}>
            交互星图保留 <strong>{stats.publishedPoets}</strong>{' '}
            位年代经过人工校核的诗人；
            全库检索则接入了三个开放语料数据集统一清洗后的{' '}
            <strong>{stats.catalogedWorks.toLocaleString('zh-CN')}</strong> 首作品。批量导入内容以
            「待校核」标注，不把语料规模冒充为已校勘的定本。
          </p>
        </header>

        <div className={styles.statsBar}>
          <div>
            <strong>{stats.publishedPoets}</strong>
            <span>星图作者</span>
          </div>
          <div>
            <strong>{stats.publishedWorks.toLocaleString('zh-CN')}</strong>
            <span>星图作者名下作品</span>
          </div>
          <div>
            <strong>{stats.catalogedPoets.toLocaleString('zh-CN')}</strong>
            <span>全库可访问作者</span>
          </div>
          <div>
            <strong>{stats.catalogedWorks.toLocaleString('zh-CN')}</strong>
            <span>全库去重作品</span>
          </div>
          <div>
            <strong>{stats.importedWorks.toLocaleString('zh-CN')}</strong>
            <span>批量导入作品</span>
          </div>
        </div>

        <section className={styles.section} aria-labelledby="sources">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.sectionOverline}>SOURCES</p>
              <h2 id="sources">三个开放数据集</h2>
            </div>
            {corpus ? (
              <p className={styles.sectionMeta}>
                数据版本 {corpus.version} · 导入耗时 {corpus.durationSeconds}s
                <br />
                {new Date(corpus.generatedAt).toLocaleString('zh-CN')}
              </p>
            ) : null}
          </div>

          {corpus ? (
            <ul className={styles.sourceList}>
              {corpus.sources.map((source) => (
                <li key={source.id} className={styles.sourceCard}>
                  <div className={styles.sourceHead}>
                    <h3>{source.title}</h3>
                    <a href={source.url ?? '#'} target="_blank" rel="noreferrer noopener">
                      {source.url ?? '—'} ↗
                    </a>
                  </div>
                  <dl className={styles.sourceStats}>
                    <div>
                      <dt>原始记录</dt>
                      <dd>{source.rawRecords.toLocaleString('zh-CN')}</dd>
                    </div>
                    <div>
                      <dt>清洗后接收</dt>
                      <dd>{source.acceptedRecords.toLocaleString('zh-CN')}</dd>
                    </div>
                    <div>
                      <dt>跳过</dt>
                      <dd>{source.skippedRecords.toLocaleString('zh-CN')}</dd>
                    </div>
                  </dl>
                  <p className={styles.sourceLicense}>{source.license}</p>
                  {source.note ? <p className={styles.sourceNote}>{source.note}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>
              尚未执行三源语料导入。管理员可运行 <code>pnpm corpora:download</code> 与{' '}
              <code>pnpm corpora:import</code> 后查看统计。
            </p>
          )}
        </section>

        {corpus ? (
          <section className={styles.section} aria-labelledby="dedupe">
            <h2 id="dedupe">清洗与去重口径</h2>
            <div className={styles.numberGrid}>
              <div>
                <strong>{corpus.totals.rawRecords.toLocaleString('zh-CN')}</strong>
                <span>原始记录（含现代语料）</span>
              </div>
              <div>
                <strong>{corpus.totals.acceptedRecords.toLocaleString('zh-CN')}</strong>
                <span>通过清理的古典记录</span>
              </div>
              <div>
                <strong>{corpus.totals.crossSourceDuplicates.toLocaleString('zh-CN')}</strong>
                <span>跨来源/跨文件重复合并</span>
              </div>
              <div>
                <strong>{corpus.totals.importedWorks.toLocaleString('zh-CN')}</strong>
                <span>新增导入作品</span>
              </div>
              <div>
                <strong>{corpus.totals.mergedWithCurated.toLocaleString('zh-CN')}</strong>
                <span>与人工校核作品合并</span>
              </div>
              <div>
                <strong>{corpus.totals.skippedModern.toLocaleString('zh-CN')}</strong>
                <span>暂不公开的现代语料</span>
              </div>
            </div>
            <ul className={styles.rules}>
              <li>
                <strong>繁简与空白：</strong>
                统一转简体、清理行首尾空白与多余空行；不补写缺字，不删除异文。
              </li>
              <li>
                <strong>作者归并：</strong>以「规范姓名 +
                时期」为归并键；同一姓名不同时期不强行合并；
                佚名作者按时期聚合为独立档案，不伪造真实身份。
              </li>
              <li>
                <strong>作品去重：</strong>以「作者 +
                正文有效字符指纹（忽略标点/空白）」跨来源去重；
                同文异题保留人工校核标题或高优先级来源标题，正文选取优先级最高者；所有来源写入
                <code>work_sources</code>。
              </li>
              <li>
                <strong>质量标记：</strong>含 <code>?</code>/<code>□</code>{' '}
                占位符、繁体转换、短文本、题缺等记录会保留并打标，页面显示「待校核」。
              </li>
              <li>
                <strong>权利边界：</strong>
                三源古典原文属公有领域；近现代/当代/民国批量语料因作者卒年与作品权利状态无法仅凭数据集核验，
                暂不公开导入，数量见统计。
              </li>
            </ul>
          </section>
        ) : null}

        <section className={styles.section} aria-labelledby="access">
          <h2 id="access">如何使用全库</h2>
          <p>
            全库内容通过搜索、作者页与作品页访问；批量导入作者<strong>不进入交互星图</strong>，
            以免把未经年代校核的作者放到错误的时间坐标上。
          </p>
          <form
            className={styles.searchForm}
            action={withBasePath('/search')}
            method="get"
            role="search"
          >
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              name="q"
              placeholder="搜索全库作者、作品标题或诗句，如：唐寅、桃花庵、明月"
              aria-label="搜索全库语料"
            />
            <button type="submit">全库检索</button>
          </form>
          <div className={styles.actions}>
            <Link href="/search?q=%E6%98%8E%E6%9C%88">从「明月」开始检索</Link>
            <Link href="/about">数据声明与来源</Link>
            <Link href="/poets">返回星图诗人名录</Link>
          </div>
        </section>

        <p className={styles.dataNote}>
          说明：{SITE_NAME} 是持续整理的数字诗词资料库，不代表全部传世作品。
          批量导入数据来自开放数据集，可能存在文本、作者归属、朝代与字符误差；发现错误请通过「关于」页渠道反馈。
        </p>

        <SiteFooter />
      </main>
    </>
  );
}
