import { useMemo } from 'react';
import { rankSeries, topMovers } from '../lib/helpers.js';

// Panel "Bao cao": xu huong rank trung binh 30 ngay, phan bo rank hien tai,
// va top bien dong 7 ngay. Pure SVG, khong them dependency.
// Luu y: rank thap = tot, nen truc Y dao nguoc (duong di len = cai thien).

function TrendChart({ series }) {
  const width = 660, height = 170, padX = 34, padY = 16;
  const pts = series.filter((s) => s.avg != null);
  if (pts.length < 2) {
    return <p style={{ fontSize: '13px', color: '#95a5a6' }}>Chua du du lieu lich su — can it nhat 2 ngay co check rank.</p>;
  }
  const avgs = pts.map((p) => p.avg);
  const min = Math.min(...avgs), max = Math.max(...avgs);
  const span = max - min || 1;
  const x = (i) => padX + (i / (pts.length - 1)) * (width - padX - 10);
  const y = (v) => padY + ((v - min) / span) * (height - padY * 2); // min (tot nhat) -> tren
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ',' + y(p.avg).toFixed(1)).join(' ');
  const first = pts[0], last = pts[pts.length - 1];
  const color = last.avg < first.avg ? '#27ae60' : last.avg > first.avg ? '#e74c3c' : '#7f8c8d';
  return (
    <div>
      <svg width="100%" viewBox={'0 0 ' + width + ' ' + height} style={{ display: 'block' }}>
        <text x="2" y={y(min) + 4} fontSize="10" fill="#95a5a6">#{min}</text>
        <text x="2" y={y(max) + 4} fontSize="10" fill="#95a5a6">#{max}</text>
        <line x1={padX} y1={y(min)} x2={width - 10} y2={y(min)} stroke="#f0f0f0" />
        <line x1={padX} y1={y(max)} x2={width - 10} y2={y(max)} stroke="#f0f0f0" />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(pts.length - 1)} cy={y(last.avg)} r="3.5" fill={color} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#95a5a6', marginTop: '4px' }}>
        <span>{first.date}</span>
        <span>Rank TB: <strong style={{ color }}>#{last.avg}</strong> ({last.tracked} tu khoa co du lieu, {last.top10} trong Top 10)</span>
        <span>{last.date}</span>
      </div>
    </div>
  );
}

function Distribution({ keywords }) {
  const buckets = [
    { label: 'Top 3', color: '#1e8449', test: (r) => r > 0 && r <= 3 },
    { label: 'Top 10', color: '#27ae60', test: (r) => r > 3 && r <= 10 },
    { label: 'Top 20', color: '#d68910', test: (r) => r > 10 && r <= 20 },
    { label: '21-100', color: '#cb4335', test: (r) => r > 20 && r <= 100 },
    { label: 'N/A / >100', color: '#95a5a6', test: (r) => !r || r > 100 },
  ];
  const total = keywords.length || 1;
  return (
    <div className="report-block">
      <h4>Phan bo rank hien tai</h4>
      {buckets.map((b) => {
        const n = keywords.filter((k) => b.test(k.currentRank)).length;
        return (
          <div key={b.label} className="dist-row">
            <span style={{ width: '80px', color: '#2c3e50', fontWeight: 600 }}>{b.label}</span>
            <div style={{ flex: 1, background: '#f4f4f4', borderRadius: '5px' }}>
              <div className="dist-bar" style={{ width: Math.max(2, (n / total) * 100) + '%', background: b.color }} />
            </div>
            <span style={{ width: '24px', textAlign: 'right', fontWeight: 700, color: '#2c3e50' }}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}

function Movers({ keywords }) {
  const movers = useMemo(() => topMovers(keywords, 7), [keywords]);
  const up = movers.filter((m) => m.delta > 0).slice(0, 5);
  const down = movers.filter((m) => m.delta < 0).slice(0, 5);
  const Row = ({ m }) => (
    <div className="mover">
      <span style={{ color: '#2c3e50' }}>{m.name}</span>
      <span style={{ fontWeight: 700, color: m.delta > 0 ? '#27ae60' : '#e74c3c', whiteSpace: 'nowrap' }}>
        #{m.from} → #{m.to}
      </span>
    </div>
  );
  return (
    <div className="report-block">
      <h4>Bien dong 7 ngay</h4>
      {!up.length && !down.length && <p style={{ fontSize: '12px', color: '#95a5a6' }}>Chua co bien dong nao trong 7 ngay qua.</p>}
      {up.length > 0 && <>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#27ae60', margin: '4px 0' }}>▲ LEN HANG</div>
        {up.map((m) => <Row key={m.id} m={m} />)}
      </>}
      {down.length > 0 && <>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#e74c3c', margin: '8px 0 4px' }}>▼ TUT HANG</div>
        {down.map((m) => <Row key={m.id} m={m} />)}
      </>}
    </div>
  );
}

export default function Report({ keywords, onClose }) {
  const series = useMemo(() => rankSeries(keywords, 30), [keywords]);
  return (
    <div className="serp-panel">
      <div className="serp-panel-header" onClick={onClose}>
        <span className="serp-panel-title">Bao cao SEO — xu huong 30 ngay</span>
        <span style={{ color: '#7f8c8d', fontSize: '12px' }}>Dong</span>
      </div>
      <div className="serp-panel-body report-grid">
        <div className="report-full report-block">
          <h4>Rank trung binh (thap = tot; duong len = cai thien)</h4>
          <TrendChart series={series} />
        </div>
        <Distribution keywords={keywords} />
        <Movers keywords={keywords} />
      </div>
    </div>
  );
}
