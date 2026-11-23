import type { Metadata } from 'next';
import Link from 'next/link';

import { SITE_NAME } from '@shihe/domain';
import type { CorpusImportStats } from '@shihe/domain';
import { getCorpusImportStats, getPublicStats } from '@shihe/db/server';

import { PageHeader, SiteFooter, StaticBackdrop } from '@/components/common/PageChrome';

import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '关于与数据声明',
  description:
    '诗河 · 千年星图的数据覆盖范围、来源与许可、年代规则与纠错方式。',
  alternates: { canonical: '/about' },
};

const SOURCES = [
  {
    title: '《全唐诗》《全宋诗》《全宋词》《元曲》',
    detail:
      '来自 chinese-poetry 开放数据集（仓库以 MIT 许可分发整理结果；古典原文属公有领域）。本项目使用简体转录文本，未复制现代注释、译文与校勘内容。',
    href: 'https://github.com/chinese-poetry/chinese-poetry',
  },
  {
    title: '《楚辞》《曹操集》《纳兰性德诗集》',
    detail:
      '同样来自 chinese-poetry 开放数据集；仅收录通行归属明确的作者作品，存疑归属会在正文中标注。',
    href: 'https://github.com/chinese-poetry/chinese-poetry',
  },
  {
    title: '古典别集与总集通行整理本（人工校核样本）',
    detail:
      '汉魏六朝、五代、金、明、清、民国部分作品依据《陶渊明集》《文选》《南唐二主词》《遗山集》《龚自珍全集》《鲁迅全集》等通行整理本录入；只录原文，不复制现代注释与校勘记。',
    href: null,
  },
  {
    title: '《唐诗三百首》《宋词三百首》',
    detail:
      '仅用于标记「代表作」排序，不作为正文底本。代表作标签不代表文学价值评分，只影响目录排序。',
    href: 'https://github.com/chinese-poetry/huajianji',
  },
  {
    title: '史传、别集与诗文交游材料（关系模式）',
    detail:
      '人物关系逐条依据《三国志》《宋史》《本事诗》等史传笔记，以及《杜诗详注》《李太白全集》《白氏长庆集》等别集中的诗文篇目；每条关系保留证据与来源定位，并区分“史料确证”与“文学史归类”。',
    href: null,
  },
];

export default async function AboutPage() {
  const [stats, corpusMeta] = await Promise.all([getPublicStats(), getCorpusImportStats()]);
  const corpus = corpusMeta as unknown as CorpusImportStats | null;

  return (
    <>
      <StaticBackdrop />
      <PageHeader current="about" />
      <main id="main-content" className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.overline}>ABOUT · 关于与数据声明</p>
          <h1 className={styles.title}>以诗为灯，照见千年。</h1>
          <p className={styles.lead}>
            {SITE_NAME} 是一个覆盖先秦至民国的中国古典诗、词、曲交互式数字星空。
            以历史年份为骨架，以真实诗人/词人/曲家为星辰，以经整理的已收录作品为可阅读内容。
          </p>
        </header>

        <div className={styles.statsBar}>
          <div>
            <strong>{stats.publishedPoets}</strong>
            <span>位星图作者</span>
          </div>
          <div>
            <strong>{stats.publishedWorks.toLocaleString('zh-CN')}</strong>
            <span>首星图作者作品</span>
          </div>
          <div>
            <strong>{stats.catalogedPoets.toLocaleString('zh-CN')}</strong>
            <span>位全库作者</span>
          </div>
          <div>
            <strong>{stats.catalogedWorks.toLocaleString('zh-CN')}</strong>
            <span>首全库作品</span>
          </div>
          <div>
            <strong>{stats.publishedRelations}</strong>
            <span>条有据关系</span>
          </div>
        </div>

        <section className={styles.section} aria-labelledby="scope">
          <h2 id="scope">数据覆盖范围</h2>
          <p>
            当前为工程验证样本，收录 {stats.publishedPoets} 位具有代表性的作者与{' '}
            {stats.publishedWorks.toLocaleString('zh-CN')}{' '}
            首作品。样本覆盖先秦、秦汉、魏晋南北朝、隋唐、
            五代十国、宋辽夏金、元、明、清、民国十个历史时期。
          </p>
        </section>

        <section className={styles.section} aria-labelledby="corpus">
          <h2 id="corpus">三源统一语料导入</h2>
          {corpus ? (
            <>
              <div className={styles.statsBar} style={{ marginTop: 18 }}>
                <div>
                  <strong>{corpus.totals.rawRecords.toLocaleString('zh-CN')}</strong>
                  <span>原始记录</span>
                </div>
                <div>
                  <strong>{corpus.totals.acceptedRecords.toLocaleString('zh-CN')}</strong>
                  <span>清洗接收</span>
                </div>
                <div>
                  <strong>{corpus.totals.crossSourceDuplicates.toLocaleString('zh-CN')}</strong>
                  <span>跨源重复合并</span>
                </div>
                <div>
                  <strong>{corpus.totals.importedPoets.toLocaleString('zh-CN')}</strong>
                  <span>导入作者</span>
                </div>
                <div>
                  <strong>{corpus.totals.skippedModern.toLocaleString('zh-CN')}</strong>
                  <span>暂不公开现代语料</span>
                </div>
              </div>
              <ul className={styles.sources}>
                {corpus.sources.map((source) => (
                  <li key={source.id}>
                    <h3>
                      {source.url ? (
                        <a href={source.url} target="_blank" rel="noreferrer noopener">
                          {source.title}
                        </a>
                      ) : (
                        source.title
                      )}
                    </h3>
                    <p>
                      原始 {source.rawRecords.toLocaleString('zh-CN')} 条 · 接收{' '}
                      {source.acceptedRecords.toLocaleString('zh-CN')} 条 · {source.license}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={styles.note}>尚未执行三源语料导入。</p>
          )}
        </section>

        <section className={styles.section} aria-labelledby="sources">
          <h2 id="sources">来源与许可</h2>
          <ul className={styles.sources}>
            {SOURCES.map((source) => (
              <li key={source.title}>
                <h3>
                  {source.href ? (
                    <a href={source.href} target="_blank" rel="noreferrer noopener">
                      {source.title}
                    </a>
                  ) : (
                    source.title
                  )}
                </h3>
                <p>{source.detail}</p>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            古典诗词原文本身属于公有领域，但现代整理本、点校、注释与数字化成果可能各自享有权利。
            本项目只使用明确标注许可的开放数据集与公有领域原文，并在作品页保留来源字段； 公开 API
            只输出已发布且权利状态为 cleared 的内容，尚未完成核验的内容不会进入全文接口。
          </p>
        </section>

        <section className={styles.section} aria-labelledby="dates">
          <h2 id="dates">年代与分期规则</h2>
          <ul className={styles.rules}>
            <li>
              内部使用统一的天文纪年整数：公元前 1 年记为 0，公元前 1046 年记为 -1045，
              <strong>系统中不存在「公元 0 年」</strong>，展示层按公元前/公元后分别格式化。
            </li>
            <li>
              生卒年、活动时期分别存储，并附带可信度（确切 / 约略 / 仅朝代 / 未知）。
              出生年未知但活动期可考者，以活动期中心作为视觉位置，界面标注「年代约略」。
            </li>
            <li>
              完全无可考年代的作者归入「年代待考」，在历史星河右端独立区域显示，绝不为美观伪造年份。
            </li>
            <li>
              宋辽夏金等并立时期按并行处理；朝代星系中的六个「文学星域」是导航分组，不是严格的历史断代。
            </li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="corrections">
          <h2 id="corrections">纠错与联系</h2>
          <p>
            如发现作品文字、作者归属或年代有误，欢迎提供出处与版本信息。
            正式上线后将在此公布纠错邮箱与数据纠错入口；当前可先通过项目仓库的 issue 提交。
          </p>
          <p className={styles.note}>
            本网站为持续整理的数字诗词资料库，不代表全部传世作品；访问统计与公开数据版本将持续更新。
          </p>
        </section>

        <div className={styles.actions}>
          <Link href="/">回到星图</Link>
          <Link href="/poets">浏览诗人名录</Link>
          <Link href="/search">全站搜索</Link>
        </div>

        <SiteFooter />
      </main>
    </>
  );
}
