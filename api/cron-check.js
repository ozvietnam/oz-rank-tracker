import { getClient } from '../lib/supabase.js';
import { sendTelegram } from '../lib/telegram.js';
import { lookupRank } from '../lib/serp.js';

// Daily cron (configured in vercel.json). Re-checks every keyword in Supabase,
// appends to rank history, and pushes a Telegram digest of notable moves.
// Vercel cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== 'Bearer ' + secret) return res.status(401).json({ error: 'Unauthorized' });
  }

  const sb = getClient();
  if (!sb) return res.status(200).json({ error: 'Supabase chua cau hinh' });
  const key = process.env.SERP_API_KEY;
  if (!key) return res.status(200).json({ error: 'SERP_API_KEY chua cau hinh' });
  const target = process.env.TARGET_DOMAIN || 'thutucxuatnhapkhau.com';
  const dropThreshold = parseInt(process.env.ALERT_DROP_THRESHOLD || '3', 10);

  const { data, error } = await sb.from('keywords').select('data');
  if (error) return res.status(500).json({ error: error.message });

  const kws = (data || []).map((r) => r.data).filter((k) => k && (k.slug || k.name));
  const today = new Date().toISOString().slice(0, 10);
  const alerts = [];
  let checked = 0;

  for (const k of kws) {
    try {
      const { rank } = await lookupRank(k.name, key, target);
      const prev = k.currentRank || 0;
      k.prevRank = prev || null;
      k.currentRank = rank;
      k.lastChecked = new Date().toLocaleString('vi-VN');
      k.updatedAt = today;
      k.history = Array.isArray(k.history) ? k.history : [];
      const lastPt = k.history[k.history.length - 1];
      if (lastPt && lastPt.date === today) lastPt.rank = rank;
      else k.history.push({ date: today, rank });
      if (k.history.length > 60) k.history = k.history.slice(-60);
      checked++;

      if (prev > 0 && rank > prev && rank - prev >= dropThreshold) {
        alerts.push('⚠️ <b>' + k.name + '</b>: #' + prev + ' → #' + rank + ' (tut ' + (rank - prev) + ')');
      } else if (prev > 10 && rank <= 10 && rank > 0) {
        alerts.push('✅ <b>' + k.name + '</b>: lot Top 10! #' + prev + ' → #' + rank);
      } else if (prev > 3 && rank <= 3 && rank > 0) {
        alerts.push('🏆 <b>' + k.name + '</b>: lot Top 3! #' + prev + ' → #' + rank);
      }
      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      // skip individual failures, keep going
    }
  }

  if (kws.length) {
    const rows = kws.map((k) => ({ id: String(k.id), data: k, updated_at: new Date().toISOString() }));
    await sb.from('keywords').upsert(rows);
  }

  if (alerts.length) {
    await sendTelegram('<b>OZ Rank Tracker</b> — bao cao ' + today + '\nDa check ' + checked + ' tu khoa.\n\n' + alerts.join('\n'));
  }

  res.status(200).json({ ok: true, checked, alerts: alerts.length });
}
