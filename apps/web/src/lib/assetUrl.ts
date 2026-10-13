const ASSET_BASE_URL = (process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

/** Resolve a site asset to the configured CDN, preserving root-relative paths locally. */
export function assetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const rootedPath = path.startsWith("/") ? path : `/${path}`;
  return `${ASSET_BASE_URL}${rootedPath}`;
}
