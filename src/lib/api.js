// Thin client for our own Vercel Serverless Functions (/api/*).
// All third-party secrets (SerpAPI, Supabase, Telegram, GSC) live server-side.
// Khi server set APP_TOKEN, moi request phai kem token — user nhap qua nut 🔑
// va token duoc giu trong localStorage.

const TOKEN_KEY = 'oz_app_token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

export function setToken(t) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

function authHeaders(extra = {}) {
  const t = getToken();
  return t ? { ...extra, 'x-app-token': t } : extra;
}

async function jsonOrThrow(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'HTTP ' + res.status);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Ask the proxy to look up the current Google Vietnam rank for a query.
export async function checkRank(query) {
  const res = await fetch('/api/check-rank?q=' + encodeURIComponent(query), { headers: authHeaders() });
  return jsonOrThrow(res); // { rank, foundUrl }
}

// SerpAPI account/quota info (real remaining searches).
export async function getAccount() {
  try {
    const res = await fetch('/api/account', { headers: authHeaders() });
    return await res.json(); // { configured, remaining, used, total } | { configured:false }
  } catch {
    return { configured: false };
  }
}

// Pull keywords from the cloud (Supabase).
// Returns { enabled, keywords } — them { authRequired: true } khi server doi token.
export async function loadCloud() {
  try {
    const res = await fetch('/api/sync', { headers: authHeaders() });
    if (res.status === 401) return { enabled: false, keywords: [], authRequired: true };
    return await res.json();
  } catch {
    return { enabled: false, keywords: [] };
  }
}

// Push the CHANGED keywords (plus any deleted ids) to the cloud.
// Server upserts per-id, nen chi gui phan da sua de khong ghi de may khac.
export async function saveCloud(keywords, deletedIds = []) {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ keywords, deletedIds }),
    });
    if (res.status === 401) return { enabled: false, authRequired: true };
    return await res.json();
  } catch (e) {
    return { enabled: false, error: e.message };
  }
}

// Pull aggregated Search Console rows for keyword matching.
export async function loadGSC() {
  const res = await fetch('/api/gsc', { headers: authHeaders() });
  return jsonOrThrow(res); // { enabled, rows:[{query,clicks,impressions,ctr,position}] }
}
