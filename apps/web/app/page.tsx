import { getSkyManifest, getPoetDetail } from '@shihe/db/server';
import { isGenre, isSkyMode } from '@shihe/domain';
import type { Genre, SkyMode } from '@shihe/domain';

import { HomeExperience } from '@/components/home/HomeExperience';

export const dynamic = 'force-dynamic';

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const manifest = await getSkyManifest();

  const rawMode = typeof params.mode === 'string' ? params.mode : undefined;
  const initialMode: SkyMode = isSkyMode(rawMode) ? rawMode : 'river';

  const rawGenre = typeof params.genre === 'string' ? params.genre : undefined;
  const initialGenre: Genre | null = isGenre(rawGenre) ? rawGenre : null;

  const initialRelations = params.relations !== '0';

  const rawPoet = typeof params.poet === 'string' ? params.poet : undefined;
  let initialPoetId: string | null = null;
  if (rawPoet) {
    const poet = await getPoetDetail(rawPoet);
    if (poet) initialPoetId = poet.id;
  }

  return (
    <HomeExperience
      manifest={manifest}
      initialMode={initialMode}
      initialPoetId={initialPoetId}
      initialGenre={initialGenre}
      initialRelations={initialRelations}
    />
  );
}
