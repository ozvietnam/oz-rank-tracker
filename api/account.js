// GET /api/account -> real SerpAPI quota for the configured account.
export default async function handler(req, res) {
  const key = process.env.SERP_API_KEY;
  if (!key) return res.status(200).json({ configured: false });
  try {
    const r = await fetch('https://serpapi.com/account?api_key=' + key);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(200).json({ configured: true, error: d.error || ('HTTP ' + r.status) });
    const total = d.searches_per_month || 0;
    const used = d.this_month_usage || 0;
    res.status(200).json({
      configured: true,
      total,
      used,
      remaining: typeof d.total_searches_left === 'number' ? d.total_searches_left : Math.max(0, total - used),
    });
  } catch (e) {
    res.status(200).json({ configured: true, error: e.message });
  }
}
