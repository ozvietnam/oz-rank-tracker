import crypto from 'crypto';

// Google Search Console client dung service account (khong them npm deps —
// JWT ky bang Node crypto). Dung chung cho /api/gsc va /api/cron-check.
// Tra ve null khi chua cau hinh GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY / GSC_SITE_URL.

function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(email, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(claim));
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey);
  const jwt = unsigned + '.' + b64url(signature);

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error_description || d.error || 'token HTTP ' + r.status);
  return d.access_token;
}

// Keo `days` ngay gan nhat theo dimension "query".
// Tra ve [{ query, clicks, impressions, ctr, position }] hoac null neu chua cau hinh.
export async function fetchGSCRows(days = 28) {
  const email = process.env.GSC_CLIENT_EMAIL;
  const privateKey = (process.env.GSC_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const site = process.env.GSC_SITE_URL;
  if (!email || !privateKey || !site) return null;

  const token = await getAccessToken(email, privateKey);
  const end = new Date();
  const start = new Date(Date.now() - days * 86400000);
  const fmt = (d) => d.toISOString().slice(0, 10);

  const r = await fetch(
    'https://searchconsole.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(site) + '/searchAnalytics/query',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ startDate: fmt(start), endDate: fmt(end), dimensions: ['query'], rowLimit: 500 }),
    }
  );
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.error && d.error.message) || 'GSC HTTP ' + r.status);

  return (d.rows || []).map((row) => ({
    query: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));
}
