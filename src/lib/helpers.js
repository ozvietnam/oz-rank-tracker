// Pure helpers shared across the UI. No React, no side effects.

export const TARGET_DOMAIN = 'thutucxuatnhapkhau.com';

export const CLUSTERS = {
  all: 'Tat Ca',
  'thiet-bi-dien': 'Thiet Bi Dien',
  'thu-tuc-xnk': 'Thu Tuc XNK',
  'vot-typti': 'Vot Typti (9 bai moi)',
};

export const SEED_KEYWORDS = [
  { slug: 'thu-tuc-nhap-khau-may-dieu-hoa-2026', name: 'thu tuc nhap khau may dieu hoa 2026', url: 'https://thutucxuatnhapkhau.com/thu-tuc-nhap-khau-may-dieu-hoa-2026/', targetRank: 5, cluster: 'thiet-bi-dien' },
  { slug: 'thu-tuc-nhap-khau-may-loc-khong-khi-2026', name: 'thu tuc nhap khau may loc khong khi 2026', url: 'https://thutucxuatnhapkhau.com/thu-tuc-nhap-khau-may-loc-khong-khi-2026/', targetRank: 5, cluster: 'thiet-bi-dien' },
  { slug: 'cach-xin-co-form-e', name: 'cach xin C/O form E', url: 'https://thutucxuatnhapkhau.com/cach-xin-co-form-e/', targetRank: 3, cluster: 'thu-tuc-xnk' },
  { slug: 'thu-tuc-nhap-khau-may-giat-2026', name: 'thu tuc nhap khau may giat 2026', url: 'https://thutucxuatnhapkhau.com/thu-tuc-nhap-khau-may-giat-2026/', targetRank: 5, cluster: 'thiet-bi-dien' },
  { slug: 'thu-tuc-nhap-khau-thang-may-2026', name: 'thu tuc nhap khau thang may 2026', url: 'https://thutucxuatnhapkhau.com/thu-tuc-nhap-khau-thang-may-2026/', targetRank: 5, cluster: 'thiet-bi-dien', isNew: true },
  { slug: 'vot-typti-la-gi', name: 'vot typti la gi', url: 'https://thutucxuatnhapkhau.com/vot-typti-la-gi/', targetRank: 3, cluster: 'vot-typti', isNew: true },
  { slug: 'thu-tuc-nhap-khau-vot-typti', name: 'thu tuc nhap khau vot typti', url: 'https://thutucxuatnhapkhau.com/thu-tuc-nhap-khau-vot-typti/', targetRank: 5, cluster: 'vot-typti', isNew: true },
  { slug: 'hs-code-vot-typti', name: 'HS code vot typti 9506.51.00', url: 'https://thutucxuatnhapkhau.com/hs-code-vot-typti/', targetRank: 5, cluster: 'vot-typti', isNew: true },
  { slug: 'hoa-don-nhap-khau-vot-typti', name: 'hoa don nhap khau vot typti', url: 'https://thutucxuatnhapkhau.com/hoa-don-nhap-khau-vot-typti/', targetRank: 5, cluster: 'vot-typti', isNew: true },
  { slug: 'nhap-si-vot-typti', name: 'nhap si vot typti tu Trung Quoc', url: 'https://thutucxuatnhapkhau.com/nhap-si-vot-typti/', targetRank: 5, cluster: 'vot-typti', isNew: true },
  { slug: 'vot-typti-vs-pickleball', name: 'vot typti vs pickleball', url: 'https://thutucxuatnhapkhau.com/vot-typti-vs-pickleball/', targetRank: 3, cluster: 'vot-typti', isNew: true },
  { slug: 'thi-truong-vot-typti-du-bao', name: 'thi truong vot typti 2026-2028', url: 'https://thutucxuatnhapkhau.com/thi-truong-vot-typti-du-bao/', targetRank: 5, cluster: 'vot-typti', isNew: true },
  { slug: 'chuyen-tu-pickleball-sang-typti', name: 'chuyen tu pickleball sang typti', url: 'https://thutucxuatnhapkhau.com/chuyen-tu-pickleball-sang-typti/', targetRank: 5, cluster: 'vot-typti', isNew: true },
];

const todayVN = () => new Date().toLocaleDateString('vi-VN');
const isoDay = () => new Date().toISOString().slice(0, 10);

export function newId() {
  return (crypto?.randomUUID && crypto.randomUUID()) || 'k_' + Date.now() + '_' + Math.random().toString(36).slice(2);
}

export function makeSeedItem(s) {
  return {
    id: newId(), slug: s.slug, name: s.name, url: s.url,
    currentRank: 0, prevRank: null, targetRank: s.targetRank,
    clicks: 0, impressions: 0, leads: 0,
    cluster: s.cluster || 'thu-tuc-xnk', isNew: s.isNew || false,
    lastChecked: null, history: [], addedAt: todayVN(), updatedAt: todayVN(),
  };
}

export function getBadge(r) {
  if (!r || r === 0) return { cls: 'badge-new', label: 'Moi/N/A' };
  if (r > 100) return { cls: 'badge-below', label: '>100' };
  if (r <= 3) return { cls: 'badge-top3', label: 'Top 3 (#' + r + ')' };
  if (r <= 10) return { cls: 'badge-top10', label: 'Top 10 (#' + r + ')' };
  if (r <= 20) return { cls: 'badge-top20', label: 'Top 20 (#' + r + ')' };
  return { cls: 'badge-below', label: '#' + r };
}

export function getTrend(c, p) {
  if (!p || !c || c === 0) return '-';
  if (c < p) return 'up+' + (p - c);
  if (c > p) return 'dn-' + (c - p);
  return '=';
}

export function pct(a, b) {
  if (!b || b === 0) return null;
  return ((a / b) * 100).toFixed(1);
}

// Append today's rank to a keyword's history (one point per day).
export function pushHistory(history, rank) {
  const h = Array.isArray(history) ? [...history] : [];
  const day = isoDay();
  if (h.length && h[h.length - 1].date === day) h[h.length - 1].rank = rank;
  else h.push({ date: day, rank });
  return h.slice(-60); // keep last ~60 points
}

// Migrate older localStorage payloads to the current shape.
export function migrate(raw) {
  return raw.map((item) => ({
    url: '', clicks: 0, impressions: 0, leads: 0, cluster: 'thu-tuc-xnk',
    isNew: false, slug: '', prevRank: null, lastChecked: null, history: [],
    addedAt: item.createdAt || todayVN(), updatedAt: todayVN(),
    ...item,
    history: Array.isArray(item.history) ? item.history : [],
  }));
}
