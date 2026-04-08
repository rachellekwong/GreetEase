const API_PREFIX = '/api';

/** Avoid dumping full HTML error pages (e.g. Express "Cannot POST /path") into toasts. */
function normalizeApiErrorMessage(status, raw) {
  if (typeof raw !== 'string') return raw;
  const t = raw.trim();
  if (!t.includes('<!DOCTYPE') && !t.includes('<html')) return t;
  const pre = t.match(/<pre[^>]*>([^<]*)<\/pre>/i);
  if (pre?.[1]) return pre[1].trim();
  return status === 404
    ? `API route not found (HTTP ${status}). Restart the backend: npm run server — or run npm run dev:all.`
    : `API error (HTTP ${status})`;
}

function getAuthHeaders() {
  if (typeof window === 'undefined') return {};
  const token =
    window.localStorage.getItem('greetease_access_token') ||
    window.localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiRequest(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    let msg =
      (typeof data === 'object' && data?.message) ||
      (typeof data === 'object' && data?.error?.message) ||
      (typeof data === 'string' ? data : null) ||
      res.statusText;
    msg = normalizeApiErrorMessage(res.status, msg);
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
