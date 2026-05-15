function StatRow({ label, value, unit, status }) {
  const valueColor =
    status === 'warn'    ? 'text-amber-400' :
    status === 'caution' ? 'text-yellow-400' :
    status === 'good'    ? 'text-green-400'  :
    'text-[var(--text-2)]'

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
      <span className="text-[10px] text-[var(--text-3)] tracking-wider uppercase">{label}</span>
      <span className={`text-[11px] font-mono ${valueColor}`}>
        {value ?? '—'}
        {unit && value != null && <span className="text-[9px] text-[var(--text-3)] ml-0.5">{unit}</span>}
      </span>
    </div>
  )
}

export default function DxfStats({ stats, thickness }) {
  if (!stats) return null

  const {
    widthMm, heightMm,
    totalCutLengthMm,
    circleCount,
    closedPolyCount,
    minHoleDiameterMm,
    minArcRadiusMm,
  } = stats

  const t = parseFloat(thickness) || 0

  // Hole diameter relative to thickness
  let holeDiaStatus = null
  if (minHoleDiameterMm != null && t > 0) {
    holeDiaStatus = minHoleDiameterMm < t ? 'warn' : minHoleDiameterMm < t * 1.5 ? 'caution' : 'good'
  }

  // Min arc radius
  let arcStatus = null
  if (minArcRadiusMm != null && t > 0) {
    arcStatus = minArcRadiusMm < t * 0.5 ? 'warn' : minArcRadiusMm < t ? 'caution' : 'good'
  }

  const profileCount = circleCount + closedPolyCount

  return (
    <div className="bracket-card rounded bg-[var(--bg-1)] border border-[var(--border)] px-3 py-1">
      {/* Header */}
      <div className="flex items-center gap-2 py-2 border-b border-[var(--border)]">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-cyan-400 shrink-0">
          <rect x="1" y="1" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M3 4h5M3 6h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        </svg>
        <span className="text-[9px] text-[var(--text-3)] tracking-widest uppercase">Profile Analysis</span>
      </div>

      <StatRow label="Dimensions"  value={`${widthMm} × ${heightMm}`} unit="mm" />
      <StatRow label="Cut Length"  value={totalCutLengthMm?.toLocaleString()} unit="mm" />
      <StatRow label="Profiles"    value={profileCount > 0 ? profileCount : null} />
      <StatRow
        label="Min Hole Ø"
        value={minHoleDiameterMm}
        unit="mm"
        status={holeDiaStatus}
      />
      <StatRow
        label="Min Arc R"
        value={minArcRadiusMm}
        unit="mm"
        status={arcStatus}
      />
    </div>
  )
}
