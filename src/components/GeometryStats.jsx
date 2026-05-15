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
        {value}
        {unit && <span className="text-[9px] text-[var(--text-3)] ml-0.5">{unit}</span>}
      </span>
    </div>
  )
}

export default function GeometryStats({ stats }) {
  if (!stats) return null

  const {
    volumeMm3,
    surfaceAreaMm2,
    fillRatio,
    downwardFaceRatio,
    distinctNormalDirections,
    triangleCount,
  } = stats

  const fillPct      = Math.round(fillRatio * 100)
  const fillStatus   = fillRatio > 0.72 ? 'good' : fillRatio < 0.4 ? 'warn' : null
  const fillLabel    = fillRatio > 0.72 ? 'Near-solid stock' : fillRatio < 0.4 ? 'Heavy pocketing / thin walls' : 'Moderate material removal'
  const fillBarColor = fillRatio > 0.72 ? 'bg-green-500' : fillRatio < 0.4 ? 'bg-amber-500' : 'bg-cyan-500'

  const downPct    = (downwardFaceRatio * 100).toFixed(1)
  const downStatus = downwardFaceRatio > 0.15 ? 'warn' : downwardFaceRatio > 0.08 ? 'caution' : 'good'

  const dirStatus = distinctNormalDirections > 6 ? 'warn' : distinctNormalDirections > 4 ? 'caution' : 'good'

  return (
    <div className="bracket-card rounded bg-[var(--bg-1)] border border-[var(--border)] px-3 py-1">
      {/* Header */}
      <div className="flex items-center gap-2 py-2 border-b border-[var(--border)]">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-cyan-400 shrink-0">
          <path d="M5.5 1L10 3.5v4L5.5 10 1 7.5v-4L5.5 1Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
          <path d="M5.5 1v9M1 3.5l9 4M10 3.5l-9 4" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5"/>
        </svg>
        <span className="text-[9px] text-[var(--text-3)] tracking-widest uppercase">Mesh Analysis</span>
      </div>

      {/* Fill ratio bar */}
      <div className="py-2 border-b border-[var(--border)]">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] text-[var(--text-3)] tracking-wider uppercase">Bbox Fill Ratio</span>
          <span className={`text-[11px] font-mono ${fillStatus === 'warn' ? 'text-amber-400' : fillStatus === 'good' ? 'text-green-400' : 'text-[var(--text-2)]'}`}>
            {fillPct}%
          </span>
        </div>
        <div className="h-1 bg-[var(--bg-3)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${fillBarColor}`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
        <p className="text-[8px] text-[var(--text-3)] mt-1 tracking-wide">{fillLabel}</p>
      </div>

      <StatRow
        label="Volume"
        value={volumeMm3.toLocaleString()}
        unit="mm³"
      />
      <StatRow
        label="Surface Area"
        value={surfaceAreaMm2.toLocaleString()}
        unit="mm²"
      />
      <StatRow
        label="Downward Faces"
        value={`${downPct}%`}
        status={downStatus}
      />
      <StatRow
        label="Face Directions"
        value={distinctNormalDirections}
        status={dirStatus}
      />
      <StatRow
        label="Triangles"
        value={triangleCount.toLocaleString()}
      />
    </div>
  )
}
