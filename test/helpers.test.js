import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pushHistory, pct, getTrend, getBadge, migrate, escCSV, topMovers, rankSeries,
} from '../src/lib/helpers.js';

const today = new Date().toISOString().slice(0, 10);

test('pushHistory: them diem moi cho ngay hom nay', () => {
  const h = pushHistory([], 7);
  assert.equal(h.length, 1);
  assert.deepEqual(h[0], { date: today, rank: 7 });
});

test('pushHistory: cung ngay thi ghi de rank, khong them diem', () => {
  const h1 = pushHistory([], 7);
  const h2 = pushHistory(h1, 3);
  assert.equal(h2.length, 1);
  assert.equal(h2[0].rank, 3);
});

test('pushHistory: gioi han 60 diem', () => {
  const old = Array.from({ length: 70 }, (_, i) => ({ date: '2026-01-' + String((i % 28) + 1).padStart(2, '0'), rank: 5 }));
  const h = pushHistory(old, 9);
  assert.equal(h.length, 60);
  assert.equal(h[h.length - 1].rank, 9);
});

test('pct: phan tram 1 chu so thap phan, null khi mau = 0', () => {
  assert.equal(pct(5, 100), '5.0');
  assert.equal(pct(1, 3), '33.3');
  assert.equal(pct(1, 0), null);
  assert.equal(pct(0, 0), null);
});

test('getTrend: len/xuong/dung yen', () => {
  assert.equal(getTrend(3, 8), 'up+5');
  assert.equal(getTrend(9, 4), 'dn-5');
  assert.equal(getTrend(5, 5), '=');
  assert.equal(getTrend(0, 5), '-');
  assert.equal(getTrend(5, null), '-');
});

test('getBadge: cac nguong rank', () => {
  assert.equal(getBadge(0).cls, 'badge-new');
  assert.equal(getBadge(3).cls, 'badge-top3');
  assert.equal(getBadge(10).cls, 'badge-top10');
  assert.equal(getBadge(20).cls, 'badge-top20');
  assert.equal(getBadge(50).cls, 'badge-below');
  assert.equal(getBadge(101).label, '>100');
});

test('migrate: dien default cho payload cu, giu nguyen field da co', () => {
  const [k] = migrate([{ id: '1', name: 'kw', currentRank: 4 }]);
  assert.equal(k.priority, false);
  assert.equal(k.gscPosition, null);
  assert.deepEqual(k.history, []);
  assert.equal(k.cluster, 'thu-tuc-xnk');
  assert.equal(k.currentRank, 4);
  const [k2] = migrate([{ id: '2', name: 'kw2', priority: true, history: [{ date: '2026-01-01', rank: 2 }] }]);
  assert.equal(k2.priority, true);
  assert.equal(k2.history.length, 1);
});

test('escCSV: boc nhay kep va nhan doi nhay kep ben trong', () => {
  assert.equal(escCSV('abc'), '"abc"');
  assert.equal(escCSV('say "hi"'), '"say ""hi"""');
  assert.equal(escCSV(null), '""');
  assert.equal(escCSV(5), '"5"');
});

test('topMovers: tinh delta so voi moc truoc cutoff (delta duong = len hang)', () => {
  const kws = [
    { id: 'a', name: 'len hang', history: [{ date: '2026-07-01', rank: 15 }, { date: '2026-07-10', rank: 8 }] },
    { id: 'b', name: 'tut hang', history: [{ date: '2026-07-01', rank: 5 }, { date: '2026-07-09', rank: 12 }] },
    { id: 'c', name: 'dung yen', history: [{ date: '2026-07-01', rank: 7 }, { date: '2026-07-10', rank: 7 }] },
    { id: 'd', name: 'thieu du lieu', history: [{ date: '2026-07-10', rank: 3 }] },
  ];
  const movers = topMovers(kws, 7, '2026-07-10');
  assert.equal(movers.length, 2);
  assert.deepEqual(movers.map((m) => m.id).sort(), ['a', 'b']);
  const a = movers.find((m) => m.id === 'a');
  assert.equal(a.delta, 7);
  assert.equal(a.from, 15);
  assert.equal(a.to, 8);
  const b = movers.find((m) => m.id === 'b');
  assert.equal(b.delta, -7);
});

test('rankSeries: carry-forward rank cuoi cung da biet, loai rank >100', () => {
  const kws = [
    { id: 'a', history: [{ date: '2026-07-01', rank: 10 }, { date: '2026-07-03', rank: 6 }] },
    { id: 'b', history: [{ date: '2026-07-02', rank: 101 }] }, // khong tim thay -> loai khoi TB
  ];
  const s = rankSeries(kws, 4, '2026-07-04'); // 07-01 -> 07-04
  assert.equal(s.length, 4);
  assert.equal(s[0].date, '2026-07-01');
  assert.equal(s[0].avg, 10);
  assert.equal(s[1].avg, 10); // carry-forward, b=101 bi loai
  assert.equal(s[2].avg, 6);
  assert.equal(s[3].avg, 6);
  assert.equal(s[3].tracked, 1);
});

test('rankSeries: diem truoc cua so van duoc carry-forward vao', () => {
  const kws = [{ id: 'a', history: [{ date: '2026-06-01', rank: 9 }] }];
  const s = rankSeries(kws, 3, '2026-07-04');
  assert.equal(s[0].avg, 9);
  assert.equal(s[2].avg, 9);
});
