// Thin client for our own Vercel Serverless Functions (/api/*).
// All third-party secrets (SerpAPI, Supabase, Telegram, GSC) live server-side.

async function jsonOrThrow(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
  return data;
}

// Ask the proxy to look up the current Google Vietnam rank for a query.
export async function checkRank(query) {
  const res = await fetch('/api/check-rank?q=' + encodeURIComponent(query));
  return jsonOrThrow(res); // { rank, foundUrl }
}

// SerpAPI account/quota info (real remaining searches).
export async function getAccount() {
  try {
    const res = await fetch('/api/account');
    return await res.json(); // { configured, remaining, used, total } | { configured:false }
  } catch {
    return { configured: false };
  }
}

// Pull keywords from the cloud (Supabase). Returns { enabled, keywords }.
export async function loadCloud() {
  try {
    const res = await fetch('/api/sync');
    return await res.json();
  } catch {
    return { enabled: false, keywords: [] };
  }
}

// Push the full keyword set (plus any deleted ids) to the cloud.
export async function saveCloud(keywords, deletedIds = []) {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords, deletedIds }),
    });
    return await res.json();
  } catch (e) {
    return { enabled: false, error: e.message };
  }
}

// Pull aggregated Search Console rows for keyword matching.
export async function loadGSC() {
  const res = await fetch('/api/gsc');
  return jsonOrThrow(res); // { enabled, rows:[{query,clicks,impressions}] }
}
