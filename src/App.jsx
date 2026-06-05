import { useState, useEffect, useMemo, useRef } from 'react';
import {
  SEED_KEYWORDS, CLUSTERS, makeSeedItem, getBadge, getTrend, pct,
  pushHistory, migrate, newId,
} from './lib/helpers.js';
import * as api from './lib/api.js';
import Sparkline from './components/Sparkline.jsx';

const SERP_QUOTA_FALLBACK = 250;
const LS_KEY = 'oz_keywords_v2';

function PctChip({ val }) {
  if (val === null) return <span className="pct-chip pct-low">-</span>;
  const n = parseFloat(val);
  const cls = n >= 5 ? 'pct-hot' : n >= 2 ? 'pct-mid' : 'pct-low';
  return <span className={'pct-chip ' + cls}>{val}%</span>;
}

export default function App() {
  const [keywords, setKeywords] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [showSerp, setShowSerp] = useState(false);
  const [alert, setAlert] = useState(null);
  const [checking, setChecking] = useState(new Set());
  const [checkAllRunning, setCheckAllRunning] = useState(false);
  const cancelRef = useRef(false);
  const [form, setForm] = useState({ name: '', url: '', rank: '', target: '' });

  // Cloud sync state
  const [cloud, setCloud] = useState({ enabled: false, loaded: false });
  const deletedRef = useRef([]);
  const dirtyRef = useRef(false);

  // SerpAPI account/quota (real, from server)
  const [acct, setAcct] = useState({ configured: false, remaining: null, used: 0, total: SERP_QUOTA_FALLBACK });
  const serpRem = acct.remaining != null ? acct.remaining : (acct.total - acct.used);
  const serpTotal = acct.total || SERP_QUOTA_FALLBACK;

  function showAlertFn(t, m, d = 4000) {
    setAlert({ type: t, msg: m });
    setTimeout(() => setAlert(null), d);
  }

  // ---- Load: localStorage first (instant), then cloud (source of truth) ----
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY) || localStorage.getItem('oz_keywords');
    if (raw) { try { setKeywords(migrate(JSON.parse(raw))); } catch { /* ignore */ } }

    (async () => {
      const res = await api.loadCloud();
      if (res.enabled) {
        if (res.keywords && res.keywords.length) {
          setKeywords(migrate(res.keywords));
          showAlertFn('success', 'Da dong bo ' + res.keywords.length + ' tu khoa tu cloud (Supabase)');
        }
        setCloud({ enabled: true, loaded: true });
      } else {
        setCloud({ enabled: false, loaded: true });
      }
    })();

    api.getAccount().then((a) => { if (a && a.configured) setAcct({ ...a, configured: true }); });
  }, []);

  // ---- Persist to localStorage on every change ----
  useEffect(() => {
    if (keywords.length > 0) localStorage.setItem(LS_KEY, JSON.stringify(keywords));
  }, [keywords]);

  // ---- Debounced push to cloud after local edits ----
  useEffect(() => {
    if (!cloud.enabled || !cloud.loaded) return;
    if (!dirtyRef.current) return;
    const t = setTimeout(async () => {
      const del = deletedRef.current;
      deletedRef.current = [];
      dirtyRef.current = false;
      await api.saveCloud(keywords, del);
    }, 1200);
    return () => clearTimeout(t);
  }, [keywords, cloud]);

  // Mutate keywords AND mark the set dirty so it gets pushed to the cloud.
  function commit(updater) {
    dirtyRef.current = true;
    setKeywords(updater);
  }

  function refreshQuota() {
    api.getAccount().then((a) => { if (a && a.configured) setAcct({ ...a, configured: true }); });
  }

  async function checkOneRank(id) {
    const kw = keywords.find((k) => k.id === id);
    if (!kw) return null;
    if (acct.configured && serpRem < 1) { showAlertFn('warning', 'Het quota SerpAPI thang nay!'); return null; }
    setChecking((prev) => new Set([...prev, id]));
    try {
      const data = await api.checkRank(kw.name); // { rank, foundUrl }
      const rank = data.rank;
      const now = new Date().toLocaleString('vi-VN');
      commit((prev) => prev.map((k) => k.id !== id ? k : {
        ...k,
        prevRank: k.currentRank || null,
        currentRank: rank,
        lastChecked: now,
        history: pushHistory(k.history, rank),
        updatedAt: new Date().toLocaleDateString('vi-VN'),
      }));
      refreshQuota();
      return rank;
    } catch (err) {
      showAlertFn('error', "Loi check '" + kw.name + "': " + err.message);
      return null;
    } finally {
      setChecking((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  async function checkAllRanks() {
    if (checkAllRunning) { cancelRef.current = true; return; }
    if (acct.configured && serpRem < 1) { showAlertFn('warning', 'Het quota SerpAPI!'); return; }
    const toCheck = keywords.filter((k) => k.slug || k.name);
    cancelRef.current = false;
    setCheckAllRunning(true);
    let checked = 0, improved = 0, dropped = 0;
    for (const kw of toCheck) {
      if (cancelRef.current) break;
      const old = kw.currentRank;
      const nr = await checkOneRank(kw.id);
      if (nr !== null) {
        checked++;
        if (old > 0 && nr < old) improved++;
        if (old > 0 && nr > old) dropped++;
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    setCheckAllRunning(false);
    if (!cancelRef.current) showAlertFn('success', 'Check xong ' + checked + ' tu khoa! Tang:' + improved + ' Giam:' + dropped);
    else showAlertFn('info', 'Dung sau ' + checked + ' tu khoa');
  }

  async function syncGSC() {
    try {
      showAlertFn('info', 'Dang keo du lieu tu Google Search Console...');
      const res = await api.loadGSC();
      if (!res.enabled) { showAlertFn('warning', 'GSC chua duoc cau hinh (xem README).'); return; }
      const rows = res.rows || [];
      const byQuery = new Map(rows.map((r) => [String(r.query).toLowerCase(), r]));
      let matched = 0;
      commit((prev) => prev.map((k) => {
        const hit = byQuery.get(String(k.name).toLowerCase());
        if (!hit) return k;
        matched++;
        return { ...k, clicks: Math.round(hit.clicks || 0), impressions: Math.round(hit.impressions || 0), updatedAt: new Date().toLocaleDateString('vi-VN') };
      }));
      showAlertFn('success', 'GSC: cap nhat ' + matched + '/' + rows.length + ' tu khoa khop.');
    } catch (e) {
      showAlertFn('error', 'Loi GSC: ' + e.message);
    }
  }

  function seedAll() {
    commit((prev) => {
      const ex = new Set(prev.map((k) => k.slug).filter(Boolean));
      const toAdd = SEED_KEYWORDS.filter((s) => !ex.has(s.slug)).map(makeSeedItem);
      if (!toAdd.length) { showAlertFn('info', 'Tat ca bai da co roi!'); return prev; }
      showAlertFn('success', 'Da them ' + toAdd.length + ' tu khoa!');
      return [...prev, ...toAdd];
    });
    setShowSeed(false);
  }

  function addKeyword(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.target) return;
    const kw = {
      id: newId(), slug: '', name: form.name.trim(), url: form.url.trim(),
      currentRank: parseInt(form.rank) || 0, prevRank: null, targetRank: parseInt(form.target),
      clicks: 0, impressions: 0, leads: 0, cluster: 'thu-tuc-xnk', isNew: false,
      lastChecked: null, history: [], addedAt: new Date().toLocaleDateString('vi-VN'), updatedAt: new Date().toLocaleDateString('vi-VN'),
    };
    commit((p) => [...p, kw]);
    setForm({ name: '', url: '', rank: '', target: '' });
    showAlertFn('success', "Them '" + kw.name + "' thanh cong");
    setShowAdd(false);
  }

  function updateField(id, field, val) {
    commit((p) => p.map((kw) => {
      if (kw.id !== id) return kw;
      const u = { ...kw, updatedAt: new Date().toLocaleDateString('vi-VN') };
      if (field === 'currentRank') {
        u.prevRank = kw.currentRank || null;
        u.currentRank = parseInt(val) || 0;
        if (u.currentRank > 0) u.history = pushHistory(kw.history, u.currentRank);
      } else {
        u[field] = parseInt(val) || 0;
      }
      return u;
    }));
  }

  function deleteKeyword(id) {
    if (!confirm('Xoa tu khoa nay?')) return;
    deletedRef.current.push(id);
    commit((p) => p.filter((k) => k.id !== id));
  }

  function exportCSV() {
    const h = ['Tu khoa', 'URL', 'Rank', 'Target', 'Prev', 'Clicks', 'Impr', 'CTR%', 'Leads', 'Conv%', 'Last Check', 'Cap nhat'];
    const rows = keywords.map((k) => [k.name, k.url, k.currentRank, k.targetRank, k.prevRank || '', k.clicks, k.impressions, pct(k.clicks, k.impressions) || 0, k.leads, pct(k.leads, k.clicks) || 0, k.lastChecked || '', k.updatedAt]);
    const csv = [h, ...rows].map((r) => r.map((v) => '"' + v + '"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'oz-rank-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
  }

  const filtered = useMemo(() => activeTab === 'all' ? keywords : keywords.filter((k) => k.cluster === activeTab), [keywords, activeTab]);
  const m = useMemo(() => ({
    total: keywords.length,
    top3: keywords.filter((k) => k.currentRank > 0 && k.currentRank <= 3).length,
    top10: keywords.filter((k) => k.currentRank > 0 && k.currentRank <= 10).length,
    clicks: keywords.reduce((s, k) => s + (k.clicks || 0), 0),
    leads: keywords.reduce((s, k) => s + (k.leads || 0), 0),
    impr: keywords.reduce((s, k) => s + (k.impressions || 0), 0),
    newC: keywords.filter((k) => k.isNew).length,
  }), [keywords]);
  const avgCTR = m.impr > 0 ? ((m.clicks / m.impr) * 100).toFixed(1) : null;
  const unseeded = SEED_KEYWORDS.filter((s) => !keywords.some((k) => k.slug === s.slug));
  const serpPct = serpTotal > 0 ? Math.min(100, (Math.max(0, serpTotal - serpRem) / serpTotal) * 100) : 0;
  const fillCls = serpPct < 60 ? 'usage-ok' : serpPct < 85 ? 'usage-warn' : 'usage-danger';
  const remLabel = acct.configured ? serpRem : '—';

  return (
    <div className="container">
      <div className="navbar">
        <div className="navbar-left">
          <h1>OZ Rank Tracker v3.0</h1>
          <p>thutucxuatnhapkhau.com | Auto check rank Google qua SerpAPI (server-side) | {remLabel}/{serpTotal} req con lai</p>
        </div>
        <div className="navbar-right">
          <span className={'sync-pill ' + (cloud.enabled ? 'sync-cloud' : 'sync-local')}>
            {cloud.enabled ? '☁ Cloud sync' : '💾 Local only'}
          </span>
          {unseeded.length > 0 && <button className="btn btn-white" onClick={() => setShowSeed(true)}>Nap {unseeded.length} Bai</button>}
          <button className="btn btn-white" style={{ background: checkAllRunning ? '#fadbd8' : 'white', color: checkAllRunning ? '#c0392b' : '#1a3a8c' }} onClick={checkAllRanks}>
            {checkAllRunning ? 'Dung Check' : 'Check All'}
          </button>
          <button className="btn btn-white" onClick={syncGSC}>Sync GSC</button>
          <button className="btn btn-white" onClick={() => setShowAdd((v) => !v)}>{showAdd ? 'Dong' : '+ Them'}</button>
          <button className="btn btn-white" onClick={exportCSV}>CSV</button>
          <button className="btn btn-white" onClick={() => setShowSerp((v) => !v)}>SerpAPI</button>
        </div>
      </div>

      {alert && <div className={'alert alert-' + alert.type}>{alert.msg}</div>}

      {showSerp && (
        <div className="serp-panel">
          <div className="serp-panel-header" onClick={() => setShowSerp(false)}>
            <span className="serp-panel-title">SerpAPI — Trang thai & Quota (Google Vietnam)</span>
            <span style={{ color: '#7f8c8d', fontSize: '12px' }}>Dong</span>
          </div>
          <div className="serp-panel-body">
            {!acct.configured ? (
              <div className="alert alert-warning" style={{ marginBottom: 0 }}>
                SerpAPI key chua duoc cau hinh tren server. Vao Vercel → Settings → Environment Variables → them <strong>SERP_API_KEY</strong> roi redeploy. Key khong con nam trong code (an toan).
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#2c3e50' }}>
                  <span>Da dung: <strong>{Math.max(0, serpTotal - serpRem)}</strong> / {serpTotal}</span>
                  <span style={{ color: serpRem > 50 ? '#27ae60' : serpRem > 20 ? '#f39c12' : '#e74c3c' }}>Con lai: <strong>{serpRem}</strong> request</span>
                </div>
                <div className="usage-bar"><div className={'usage-fill ' + fillCls} style={{ width: serpPct + '%' }}></div></div>
                <div style={{ fontSize: '11px', color: '#95a5a6', marginTop: '6px' }}>
                  Check All = {keywords.length} req | Check 1 tu khoa = 1 req | Quota lay truc tiep tu tai khoan SerpAPI.
                  <button className="btn btn-sm btn-white" style={{ marginLeft: '10px', border: '1px solid #e0e0e0' }} onClick={refreshQuota}>Lam moi quota</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showSeed && unseeded.length > 0 && (
        <div className="seed-panel">
          <h3>Nap Bai Viet Vao Tracker</h3>
          <p>Tim thay <strong>{unseeded.length} bai chua co</strong> trong tracker.</p>
          <div className="seed-list">{unseeded.map((s) => <span key={s.slug} className="seed-tag">{s.isNew ? '[MOI] ' : ''}{s.name}</span>)}</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary" onClick={seedAll}>Nap Tat Ca ({unseeded.length})</button>
            <button className="btn btn-sm" style={{ background: '#ecf0f1', color: '#7f8c8d' }} onClick={() => setShowSeed(false)}>Huy</button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="form-section">
          <h2>Them Tu Khoa Thu Cong</h2>
          <form onSubmit={addKeyword}>
            <div className="form-grid">
              <div className="form-group"><label>Tu Khoa</label><input type="text" placeholder="nhap khau may 2026" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="form-group"><label>URL</label><input type="text" placeholder="https://thutucxuatnhapkhau.com/..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
              <div className="form-group"><label>Rank Hien</label><input type="number" placeholder="0" min="0" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} /></div>
              <div className="form-group"><label>Target</label><input type="number" placeholder="5" min="1" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required /></div>
              <button type="submit" className="btn btn-primary">Them</button>
            </div>
          </form>
        </div>
      )}

      <div className="metrics-grid">
        <div className="metric-card blue"><h3>Tong Tu Khoa</h3><div className="metric-value">{m.total}</div><div className="metric-sub">{m.newC} bai moi</div></div>
        <div className="metric-card green"><h3>Top 3</h3><div className="metric-value">{m.top3}</div><div className="metric-sub">tu khoa</div></div>
        <div className="metric-card orange"><h3>Top 10</h3><div className="metric-value">{m.top10}</div><div className="metric-sub">tu khoa</div></div>
        <div className="metric-card teal"><h3>Clicks/tuan</h3><div className="metric-value">{m.clicks.toLocaleString()}</div><div className="metric-sub">tu GSC</div></div>
        <div className="metric-card purple"><h3>CTR TB</h3><div className="metric-value">{avgCTR !== null ? avgCTR + '%' : '—'}</div><div className="metric-sub">clicks/impr</div></div>
        <div className="metric-card red"><h3>Leads/tuan</h3><div className="metric-value">{m.leads}</div><div className="metric-sub">form submits</div></div>
      </div>

      <div className="tabs">
        {Object.entries(CLUSTERS).map(([key, label]) => (
          <button key={key} className={'tab ' + (activeTab === key ? 'active' : '')} onClick={() => setActiveTab(key)}>
            {label} ({key === 'all' ? keywords.length : keywords.filter((k) => k.cluster === key).length})
          </button>
        ))}
      </div>

      <div className="table-section">
        <div className="table-header">
          <h2>{CLUSTERS[activeTab]} — {filtered.length} tu khoa</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#95a5a6' }}>SerpAPI: {remLabel} req con</span>
            <button className="btn btn-check btn-sm" disabled={acct.configured && serpRem < 1}
              onClick={() => {
                const ids = filtered.filter((k) => k.slug || k.name).map((k) => k.id);
                if (!ids.length) return;
                showAlertFn('info', 'Dang check ' + ids.length + ' tu khoa...');
                (async () => { for (const id of ids) { await checkOneRank(id); await new Promise((r) => setTimeout(r, 800)); } showAlertFn('success', 'Check xong tab nay!'); })();
              }}>Check Tab Nay</button>
          </div>
        </div>
        <div className="table-wrap">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p>Chua co tu khoa nao.</p>
              {unseeded.length > 0 && <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => setShowSeed(true)}>Nap {unseeded.length} Bai</button>}
            </div>
          ) : (
            <table>
              <thead><tr>
                <th style={{ minWidth: '200px' }}>Tu Khoa / URL</th>
                <th>Rank</th><th>Target</th><th>Trend</th>
                <th>Lich Su<br /><span style={{ fontSize: '10px', fontWeight: 400 }}>rank</span></th>
                <th>Rank Moi<br /><span style={{ fontSize: '10px', fontWeight: 400 }}>(thu cong)</span></th>
                <th>Clicks<br /><span style={{ fontSize: '10px', fontWeight: 400 }}>GSC</span></th>
                <th>Impr.<br /><span style={{ fontSize: '10px', fontWeight: 400 }}>GSC</span></th>
                <th>CTR%</th>
                <th>Leads</th><th>Conv%</th>
                <th>Check<br /><span style={{ fontSize: '10px', fontWeight: 400 }}>Google</span></th>
                <th>Xoa</th>
              </tr></thead>
              <tbody>
                {filtered.map((kw) => {
                  const badge = getBadge(kw.currentRank), trend = getTrend(kw.currentRank, kw.prevRank);
                  const ctr = pct(kw.clicks, kw.impressions), conv = pct(kw.leads, kw.clicks);
                  const isChk = checking.has(kw.id);
                  return (
                    <tr key={kw.id} className={isChk ? 'row-checking' : kw.isNew ? 'row-new' : ''}>
                      <td>
                        <div className="keyword-name">
                          {kw.isNew && <span style={{ fontSize: '10px', background: '#c0392b', color: 'white', borderRadius: '3px', padding: '1px 5px', marginRight: '5px' }}>MOI</span>}
                          {kw.name}
                        </div>
                        {kw.url && <div className="keyword-url"><a href={kw.url} target="_blank" rel="noopener">{kw.url.replace('https://thutucxuatnhapkhau.com', '')}</a></div>}
                        {kw.lastChecked && <div className="last-checked">checked: {kw.lastChecked}</div>}
                      </td>
                      <td><span className={'badge ' + badge.cls}>{badge.label}</span></td>
                      <td style={{ color: '#7f8c8d', fontWeight: 600 }}>#{kw.targetRank}</td>
                      <td style={{ textAlign: 'center', fontSize: '14px' }}>{trend}</td>
                      <td><Sparkline history={kw.history} /></td>
                      <td><input type="number" className="num-input" min="0" value={kw.currentRank} onChange={(e) => updateField(kw.id, 'currentRank', e.target.value)} /></td>
                      <td><input type="number" className="num-input" min="0" value={kw.clicks} onChange={(e) => updateField(kw.id, 'clicks', e.target.value)} /></td>
                      <td><input type="number" className="num-input" min="0" value={kw.impressions} onChange={(e) => updateField(kw.id, 'impressions', e.target.value)} /></td>
                      <td><PctChip val={ctr} /></td>
                      <td><input type="number" className="num-input" min="0" value={kw.leads} onChange={(e) => updateField(kw.id, 'leads', e.target.value)} /></td>
                      <td><PctChip val={conv} /></td>
                      <td style={{ textAlign: 'center' }}>
                        {isChk ? <span className="spin" style={{ fontSize: '18px' }}>⏳</span> :
                          <button className="btn btn-check" onClick={() => checkOneRank(kw.id)} disabled={acct.configured && serpRem < 1} title={'Check rank cho: ' + kw.name}>Check</button>}
                      </td>
                      <td><button className="btn btn-danger" onClick={() => deleteKeyword(kw.id)}>X</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="footer">
        <p>Du lieu luu localStorage (offline cache){cloud.enabled ? ' + dong bo cloud Supabase (da thiet bi)' : ''}.</p>
        <p>Rank check qua SerpAPI server-side (Google Vietnam){acct.configured ? ' — ' + serpRem + '/' + serpTotal + ' request con lai' : ' — chua cau hinh key'}.</p>
        <p>OZ Rank Tracker v3.0 — thutucxuatnhapkhau.com</p>
      </div>
    </div>
  );
}
