import { getClient } from '../lib/supabase.js';
import { sendTelegram } from '../lib/telegram.js';
import { lookupRank } from '../lib/serp.js';
import { fetchGSCRows } from '../lib/gsc.js';

// Daily cron (configured in vercel.json). Budget-aware de khong chet giua chung
// vi gioi han thoi gian function cua Vercel: tu khoa duoc check theo thu tu
// lau-chua-check nhat truoc, phan khong kip trong CRON_TIME_BUDGET_MS se don
// sang lan chay sau (tien do van duoc upsert).
//
// Tiet kiem quota SerpAPI: tu khoa uu tien (⭐) check hang ngay, con lai moi
// CHECK_INTERVAL_DAYS ngay. Clicks/Impressions/Position keo tu GSC (mien phi,
// 1 request) truoc khi check rank.
//
// Telegram: canh bao khi rank bien dong + digest tong hop vao WEEKLY_DIGEST_DAY.
// Vercel cron gui `Authorization: Bearer <CRON_SECRET>` khi CRON_SECRET duoc set.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isoDay = () => new Date().toISOString().slice(0, 10);
const lastCheckDate = (k) => (Array.isArray(k.history) && k.history.length ? k.history[k.history.length - 1].date : '');

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
  const intervalDays = parseInt(process.env.CHECK_INTERVAL_DAYS || '3', 10);
  const budgetMs = parseInt(process.env.CRON_TIME_BUDGET_MS || '45000', 10);
  const started = Date.now();

  const { data, error } = await sb.from('keywords').select('data');
  if (error) return res.status(500).json({ error: error.message });

  const kws = (data || []).map((r) => r.data).filter((k) => k && (k.slug || k.name));
  const today = isoDay();
  const touched = new Set();

  // --- GSC: 1 request mien phi dien clicks/impressions/position cho moi tu khoa khop ---
  let gscMatched = 0;
  try {
    const rows = await fetchGSCRows();
    if (rows) {
      const byQuery = new Map(rows.map((r) => [String(r.query).toLowerCase(), r]));
      for (const k of kws) {
        const hit = byQuery.get(String(k.name).toLowerCase());
        if (!hit) continue;
        k.clicks = Math.round(hit.clicks || 0);
        k.impressions = Math.round(hit.impressions || 0);
        k.gscPosition = hit.position ? Math.round(hit.position * 10) / 10 : null;
        k.updatedAt = today;
        touched.add(k.id);
        gscMatched++;
      }
    }
  } catch { /* GSC best-effort; van check rank */ }

  // --- SerpAPI: chi check tu khoa den han, lau-chua-check nhat truoc ---
  const daysSince = (d) => (d ? Math.floor((Date.parse(today) - Date.parse(d)) / 86400000) : Infinity);
  const due = kws
    .filter((k) => {
      const last = lastCheckDate(k);
      if (last === today) return false;
      return k.priority ? true : daysSince(last) >= intervalDays;
    })
    .sort((a, b) => (lastCheckDate(a) < lastCheckDate(b) ? -1 : 1));

  const alerts = [];
  let checked = 0;
  for (const k of due) {
    if (Date.now() - started > budgetMs) break; // phan con lai don sang lan chay sau
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
      touched.add(k.id);
      checked++;

      if (prev > 0 && rank > prev && rank - prev >= dropThreshold) {
        alerts.push('⚠️ <b>' + k.name + '</b>: #' + prev + ' → #' + rank + ' (tut ' + (rank - prev) + ')');
      } else if (prev > 10 && rank <= 10 && rank > 0) {
        alerts.push('✅ <b>' + k.name + '</b>: lot Top 10! #' + prev + ' → #' + rank);
      } else if (prev > 3 && rank <= 3 && rank > 0) {
        alerts.push('🏆 <b>' + k.name + '</b>: lot Top 3! #' + prev + ' → #' + rank);
      }
      await sleep(600);
    } catch {
      // skip individual failures, keep going
    }
  }

  if (touched.size) {
    const rows = kws
      .filter((k) => touched.has(k.id))
      .map((k) => ({ id: String(k.id), data: k, updated_at: new Date().toISOString() }));
    await sb.from('keywords').upsert(rows);
  }

  // --- Telegram: canh bao bien dong + digest tuan ---
  const digestDay = parseInt(process.env.WEEKLY_DIGEST_DAY || '1', 10); // 1 = thu Hai (UTC)
  const isDigestDay = new Date().getUTCDay() === digestDay;
  const parts = [];
  if (isDigestDay) {
    const ranked = kws.filter((k) => k.currentRank > 0 && k.currentRank <= 100);
    const top3 = ranked.filter((k) => k.currentRank <= 3).length;
    const top10 = ranked.filter((k) => k.currentRank <= 10).length;
    const clicks = kws.reduce((s, k) => s + (k.clicks || 0), 0);
    const leads = kws.reduce((s, k) => s + (k.leads || 0), 0);
    parts.push('📊 <b>Digest tuan</b>: ' + kws.length + ' tu khoa | Top 3: ' + top3 +
      ' | Top 10: ' + top10 + ' | Clicks (28d): ' + clicks + ' | Leads: ' + leads);
  }
  if (alerts.length) parts.push(alerts.join('\n'));
  if (parts.length) {
    await sendTelegram('<b>OZ Rank Tracker</b> — ' + today +
      ' (check ' + checked + '/' + due.length + ' tu khoa den han)\n\n' + parts.join('\n\n'));
  }

  res.status(200).json({
    ok: true, checked, due: due.length,
    remaining: Math.max(0, due.length - checked),
    gscMatched, alerts: alerts.length,
  });
}
