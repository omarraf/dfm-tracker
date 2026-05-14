const DIFFICULTY_CLASS = {
  'easy':      'badge-easy',
  'medium':    'badge-medium',
  'hard':      'badge-hard',
  'very hard': 'badge-veryhard',
}

const ISSUE_TYPE_LABEL = {
  undercuts:            'Undercuts',
  thin_walls:           'Thin Walls',
  deep_pockets:         'Deep Pockets',
  tight_internal_radii: 'Tight Internal Radii',
  surface_finish:       'Surface Finish',
  tool_access:          'Tool Access',
  fixturing:            'Fixturing',
  other:                'Other',
}

function DifficultyBadge({ value }) {
  const cls = DIFFICULTY_CLASS[value?.toLowerCase()] ?? 'badge-unknown'
  return (
    <span className={`font-mono text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${cls}`}>
      {value ?? '—'}
    </span>
  )
}

function ScorePips({ score, max = 5 }) {
  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-sm transition-colors ${
            i < score ? 'pip-filled' : 'pip-empty'
          }`}
        />
      ))}
      <span className="ml-1 text-[10px] text-[var(--text-2)]">{score}/{max}</span>
    </div>
  )
}

function SeverityDot({ severity }) {
  const cls =
    severity === 'high'   ? 'sev-high' :
    severity === 'medium' ? 'sev-medium' :
    'sev-low'
  return (
    <span className={`text-[8px] font-mono uppercase tracking-wider ${cls}`}>
      {severity}
    </span>
  )
}

function MetaRow({ label, children }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
      <span className="text-[10px] text-[var(--text-3)] tracking-wider uppercase">{label}</span>
      <div className="font-mono">{children}</div>
    </div>
  )
}

export default function AnalysisResults({ result }) {
  if (!result) return null

  const { complexity_score, machining_difficulty, recommended_axes,
          lead_time_estimate, flagged_issues, summary } = result

  return (
    <div className="slide-up space-y-3">
      {/* Metrics grid */}
      <div className="bracket-card rounded bg-[var(--bg-1)] border border-[var(--border)] px-3 py-1">
        <MetaRow label="Complexity">
          <ScorePips score={complexity_score} />
        </MetaRow>
        <MetaRow label="Difficulty">
          <DifficultyBadge value={machining_difficulty} />
        </MetaRow>
        <MetaRow label="Recommended Axes">
          <span className="text-[11px] text-cyan-400">{recommended_axes}</span>
        </MetaRow>
        <MetaRow label="Lead Time">
          <span className="text-[11px] text-[var(--text-2)]">{lead_time_estimate}</span>
        </MetaRow>
      </div>

      {/* Flagged issues */}
      {flagged_issues && flagged_issues.length > 0 && (
        <div className="bracket-card rounded bg-[var(--bg-1)] border border-[var(--border)] p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-amber-500">
              <path d="M6 1L11 10H1L6 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M6 5v2.5M6 9v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span className="text-[9px] text-[var(--text-3)] tracking-widest uppercase">
              Flagged Issues ({flagged_issues.length})
            </span>
          </div>
          <div className="space-y-2">
            {flagged_issues.map((issue, i) => (
              <div
                key={i}
                className="flex gap-2.5 items-start border border-[var(--border)] rounded p-2 bg-[var(--bg-2)]"
              >
                <div
                  className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${
                    issue.severity === 'high'   ? 'bg-red-500' :
                    issue.severity === 'medium' ? 'bg-yellow-400' :
                    'bg-green-500'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] text-[var(--text-1)] font-mono">
                      {ISSUE_TYPE_LABEL[issue.type] ?? issue.type}
                    </span>
                    <SeverityDot severity={issue.severity} />
                  </div>
                  <p className="text-[10px] text-[var(--text-2)] leading-relaxed">
                    {issue.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {flagged_issues && flagged_issues.length === 0 && (
        <div className="rounded border border-green-500/20 bg-green-500/5 p-3 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-green-400 shrink-0">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M3.5 6l2 2 3-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[10px] text-green-400">No critical manufacturability issues detected</span>
        </div>
      )}

      {/* Machinist summary */}
      {summary && (
        <div className="bracket-card rounded bg-[var(--bg-1)] border border-[var(--border)] p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[9px] text-[var(--text-3)] tracking-widest uppercase">
              Machinist Assessment
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-2)] leading-relaxed italic">
            &ldquo;{summary}&rdquo;
          </p>
        </div>
      )}
    </div>
  )
}
