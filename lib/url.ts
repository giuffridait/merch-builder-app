const DEFAULT_BASE_URL = 'https://merch-builder-app.vercel.app';

function normalizeBaseUrl(value?: string) {
  if (!value) return DEFAULT_BASE_URL;
  if (value.startsWith('http://') || value.startsWith('https://')) return value.replace(/\/+$/, '');
  return `https://${value.replace(/\/+$/, '')}`;
}

export function getPublicBaseUrl() {
  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.VERCEL_URL ||
    DEFAULT_BASE_URL;
  return normalizeBaseUrl(base);
}

export function toAbsoluteUrl(url?: string) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = getPublicBaseUrl();
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}
