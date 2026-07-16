import { requireAuth } from '../lib/auth.js';
import { fetchGSCRows } from '../lib/gsc.js';

// GET /api/gsc -> { enabled, rows: [{ query, clicks, impressions, ctr, position }] }
// Keo 28 ngay gan nhat tu Search Console (logic nam trong lib/gsc.js de cron dung chung).
export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    const rows = await fetchGSCRows();
    if (!rows) return res.status(200).json({ enabled: false });
    res.status(200).json({ enabled: true, rows });
  } catch (e) {
    res.status(502).json({ enabled: true, error: e.message });
  }
}
