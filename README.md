# 诗河 · 千年星图

以先秦至民国的中国古典诗词为主题的交互星图。沿「历史星河」按年代漫游，或切换到「朝代星系」探索文学星域。点击诗人可查看生平、人物关系和作品目录，也可以按诗人、篇名或诗句搜索原文。

**在线演示** · [http://115.159.221.203/](http://115.159.221.203/)

## 截图

| 历史星河 | 诗词原文 |
| --- | --- |
| ![历史星河首页](screenshots/sky.webp) | ![辛弃疾《青玉案·元夕》阅读页](screenshots/reader.webp) |

## 本地运行

需要 Node.js 22+、pnpm 10 和 Docker Compose。应用使用 Next.js、React、PixiJS 和 PostgreSQL。

```sh
pnpm install --frozen-lockfile
cp .env.example .env
set -a
. ./.env
set +a
docker compose up -d --wait postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。已有 PostgreSQL 16 时，可配置 `DATABASE_URL`，再执行迁移和种子导入。生产构建使用 `pnpm build`，构建完成后运行 `pnpm start`。

仓库附带基础种子数据，用于本地体验双模式星图、关系、检索和阅读。线上演示另有全库语料。作品底本和来源可在阅读页查看。
