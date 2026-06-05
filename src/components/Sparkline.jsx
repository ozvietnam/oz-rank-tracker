// Tiny dependency-free SVG sparkline for rank history.
// Note: lower rank = better, so we invert the Y axis (a rising line = improving).
export default function Sparkline({ history, width = 90, height = 28 }) {
  const pts = (history || []).filter((p) => p && p.rank > 0 && p.rank <= 100);
  if (pts.length < 2) {
    return <span style={{ fontSize: '11px', color: '#bdc3c7' }}>—</span>;
  }
  const ranks = pts.map((p) => p.rank);
  const min = Math.min(...ranks);
  const max = Math.max(...ranks);
  const span = max - min || 1;
  const stepX = width / (pts.length - 1);
  // rank=min (best) -> top; rank=max (worst) -> bottom
  const y = (r) => 3 + ((r - min) / span) * (height - 6);
  const coords = pts.map((p, i) => [i * stepX, y(p.rank)]);
  const path = coords.map(([x, yy], i) => (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + yy.toFixed(1)).join(' ');
  const first = pts[0].rank;
  const last = pts[pts.length - 1].rank;
  const color = last < first ? '#27ae60' : last > first ? '#e74c3c' : '#7f8c8d';
  const [lx, ly] = coords[coords.length - 1];
  const title = `${pts.length} lan check | #${first} -> #${last}`;
  return (
    <span className="spark-cell" title={title}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lx} cy={ly} r="2.4" fill={color} />
      </svg>
    </span>
  );
}
