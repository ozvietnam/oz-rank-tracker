import { lookupRank } from '../lib/serp.js';
import { requireAuth } from '../lib/auth.js';

// GET /api/check-rank?q=<keyword>
// Proxies SerpAPI server-side so the key is never exposed and CORS is a non-issue.
export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const key = process.env.SERP_API_KEY;
  if (!key) return res.status(500).json({ error: 'SERP_API_KEY chua duoc cau hinh tren Vercel' });
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Thieu tham so q' });
  const target = process.env.TARGET_DOMAIN || 'thutucxuatnhapkhau.com';
  try {
    const out = await lookupRank(q, key, target);
    res.status(200).json(out);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
