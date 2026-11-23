import type {
  Paginated,
  PoetDetail,
  PoetRelation,
  PoetWorkListQuery,
  SearchResultGroups,
  SkyManifest,
  SkyMode,
  SkyTileResponse,
  WorkDetail,
  WorkSummary,
} from '@shihe/domain';

import { BASE_PATH } from '../base-path';

const API_BASE = `${BASE_PATH}/api/v1`;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { accept: 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    let code = 'INTERNAL';
    let message = `请求失败（${response.status}）`;
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // 保留默认错误信息
    }
    throw new ApiError(response.status, code, message);
  }
  return (await response.json()) as T;
}

export async function fetchManifest(): Promise<SkyManifest> {
  const body = await request<{ data: SkyManifest }>('/sky/manifest');
  return body.data;
}

export async function fetchSkyTile(params: {
  mode: SkyMode;
  z: number;
  x: number;
  y: number;
}): Promise<SkyTileResponse> {
  const query = new URLSearchParams({
    mode: params.mode,
    z: String(params.z),
    x: String(params.x),
    y: String(params.y),
  });
  const body = await request<{
    data: SkyTileResponse['stars'];
    meta: { mode: SkyMode; z: number; x: number; y: number };
  }>(`/sky/tiles?${query.toString()}`);
  return { ...body.meta, stars: body.data };
}

export async function searchApi(params: {
  q: string;
  type?: 'poet' | 'work';
  limit?: number;
}): Promise<SearchResultGroups> {
  const query = new URLSearchParams({ q: params.q });
  if (params.type) query.set('type', params.type);
  if (params.limit) query.set('limit', String(params.limit));
  const body = await request<{ data: SearchResultGroups }>(`/search?${query.toString()}`);
  return body.data;
}

export async function fetchPoet(id: string): Promise<PoetDetail> {
  const body = await request<{ data: PoetDetail }>(`/poets/${encodeURIComponent(id)}`);
  return body.data;
}

export async function fetchPoetWorks(
  id: string,
  params: PoetWorkListQuery = {},
): Promise<
  Paginated<WorkSummary> & {
    poetName: string;
    dynastyLabel: string;
    genres: WorkSummary['genre'][];
  }
> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.q) query.set('q', params.q);
  if (params.genre) query.set('genre', params.genre);
  const body = await request<{
    data: WorkSummary[];
    meta: {
      total: number;
      limit: number;
      nextCursor: string | null;
      poetName: string;
      dynastyLabel: string;
      genres: WorkSummary['genre'][];
    };
  }>(`/poets/${encodeURIComponent(id)}/works?${query.toString()}`);
  return {
    data: body.data,
    meta: {
      total: body.meta.total,
      limit: body.meta.limit,
      nextCursor: body.meta.nextCursor,
    },
    poetName: body.meta.poetName,
    dynastyLabel: body.meta.dynastyLabel,
    genres: body.meta.genres,
  };
}

export async function fetchPoetRelations(
  id: string,
): Promise<{ relations: PoetRelation[]; available: boolean; note: string }> {
  const body = await request<{
    data: PoetRelation[];
    meta: { available: boolean; note: string };
  }>(`/poets/${encodeURIComponent(id)}/relations`);
  return {
    relations: body.data,
    available: body.meta.available,
    note: body.meta.note,
  };
}

export async function fetchWork(id: string): Promise<WorkDetail> {
  const body = await request<{ data: WorkDetail }>(`/works/${encodeURIComponent(id)}`);
  return body.data;
}
