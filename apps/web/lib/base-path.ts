/**
 * 站点可部署在域名根路径，也可部署在反向代理子路径（如 /poetry）。
 * Next.js 的 basePath 会自动处理 Link/router/静态资源；这里补充手动拼接 URL 的场景。
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function withBasePath(path: string): string {
  if (!BASE_PATH) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}
