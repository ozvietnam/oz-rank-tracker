import { getClient } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';

// GET  /api/sync          -> { enabled, keywords: [...] }
// POST /api/sync { keywords, deletedIds } -> upsert + delete
// Each keyword is stored as a JSONB blob keyed by its id (schema-light).
// POST chi upsert cac keyword duoc gui len (client gui phan da sua, khong gui ca mang).
export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const sb = getClient();
  if (!sb) return res.status(200).json({ enabled: false, keywords: [] });

  try {
    if (req.method === 'GET') {
      const { data, error } = await sb.from('keywords').select('data').order('updated_at', { ascending: true });
      if (error) throw error;
      return res.status(200).json({ enabled: true, keywords: (data || []).map((r) => r.data) });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const kws = Array.isArray(body.keywords) ? body.keywords : [];
      const deletedIds = Array.isArray(body.deletedIds) ? body.deletedIds.map(String) : [];

      if (deletedIds.length) {
        const { error } = await sb.from('keywords').delete().in('id', deletedIds);
        if (error) throw error;
      }
      if (kws.length) {
        const rows = kws.map((k) => ({ id: String(k.id), data: k, updated_at: new Date().toISOString() }));
        const { error } = await sb.from('keywords').upsert(rows);
        if (error) throw error;
      }
      return res.status(200).json({ enabled: true, ok: true, upserted: kws.length, deleted: deletedIds.length });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
