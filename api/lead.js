import { getClient } from '../lib/supabase.js';

// POST /api/lead — webhook cho form website: cong don `leads` vao tu khoa khop.
// Body JSON: { url?: string, keyword?: string, count?: number }
// Auth: header `x-lead-secret` (hoac ?secret=) phai khop LEAD_WEBHOOK_SECRET
// (fallback APP_TOKEN). Khong cau hinh secret -> endpoint tat (khong cho ghi mo).
const norm = (s) => String(s || '').toLowerCase().replace(/\/+$/, '');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.LEAD_WEBHOOK_SECRET || process.env.APP_TOKEN;
  if (!secret) return res.status(503).json({ error: 'Chua cau hinh LEAD_WEBHOOK_SECRET' });
  const given = req.headers['x-lead-secret'] || req.query.secret || '';
  if (given !== secret) return res.status(401).json({ error: 'Sai secret' });

  const sb = getClient();
  if (!sb) return res.status(503).json({ error: 'Supabase chua cau hinh' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const byUrl = norm(body.url);
    const byKw = String(body.keyword || '').trim().toLowerCase();
    const count = Math.max(1, parseInt(body.count, 10) || 1);
    if (!byUrl && !byKw) return res.status(400).json({ error: 'Thieu url hoac keyword' });

    const { data, error } = await sb.from('keywords').select('data');
    if (error) throw error;
    const hit = (data || []).map((r) => r.data).find((k) =>
      k && ((byUrl && norm(k.url) === byUrl) || (byKw && String(k.name).toLowerCase() === byKw)));
    if (!hit) return res.status(404).json({ error: 'Khong tim thay tu khoa khop' });

    hit.leads = (parseInt(hit.leads, 10) || 0) + count;
    hit.updatedAt = new Date().toISOString().slice(0, 10);
    const { error: e2 } = await sb.from('keywords')
      .upsert({ id: String(hit.id), data: hit, updated_at: new Date().toISOString() });
    if (e2) throw e2;

    res.status(200).json({ ok: true, keyword: hit.name, leads: hit.leads });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
