import { useEffect, useState, useCallback } from 'react'
import { getAllAnalyses, deleteAnalysis } from '../lib/db'

const DIFF_CLASS = {
  'easy':      'badge-easy',
  'medium':    'badge-medium',
  'hard':      'badge-hard',
  'very hard': 'badge-veryhard',
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)       return 'just now'
  if (s < 3600)     return `${Math.floor(s / 60)}m ago`
  if (s < 86400)    return `${Math.floor(s / 3600)}h ago`
  if (s < 604800)   return `${Math.floor(s / 86400)}d ago`
  return new Date(ts).toLocaleDateString()
}

export default function HistoryPanel({ onLoad }) {
  const [items, setItems]       = useState([])
  const [expanded, setExpanded] = useState(true)

  const refresh = useCallback(async () => {
    const all = await getAllAnalyses()
    setItems(all)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Expose refresh so parent can call it after saving
  useEffect(() => {
    window.__dfmHistoryRefresh = refresh
    return () => { delete window.__dfmHistoryRefresh }
  }, [refresh])

  const handleDelete = useCallback(async (e, id) => {
    e.stopPropagation()
    await deleteAnalysis(id)
    refresh()
  }, [refresh])

  if (items.length === 0) return null

  return (
    <div className="mt-1">
      {/* Header toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between py-2 text-[9px] text-[var(--text-3)] tracking-widest uppercase hover:text-[var(--text-2)] transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1" y="1" width="3" height="3" stroke="currentColor" strokeWidth="1"/>
            <rect x="6" y="1" width="3" height="3" stroke="currentColor" strokeWidth="1"/>
            <rect x="1" y="6" width="3" height="3" stroke="currentColor" strokeWidth="1"/>
            <rect x="6" y="6" width="3" height="3" stroke="currentColor" strokeWidth="1"/>
          </svg>
          History ({items.length})
        </span>
        <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 3l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </span>
      </button>

      {expanded && (
        <div className="space-y-1.5 pb-2">
          {items.map((item) => {
            const diff = item.result?.machining_difficulty
            const cls  = DIFF_CLASS[diff?.toLowerCase()] ?? 'badge-unknown'
            const iso  = item.screenshots?.[3] // isometric

            return (
              <button
                key={item.id}
                onClick={() => onLoad(item)}
                className="w-full text-left rounded border border-[var(--border)] bg-[var(--bg-2)] hover:border-[var(--text-3)] hover:bg-[var(--bg-3)] transition-all group flex gap-2.5 p-2"
              >
                {/* Thumbnail */}
                <div className="w-10 h-10 shrink-0 rounded overflow-hidden bg-[var(--bg-3)] border border-[var(--border)]">
                  {iso
                    ? <img src={iso} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"/>
                    : <div className="w-full h-full flex items-center justify-center text-[var(--text-3)] text-[8px]">—</div>
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[var(--text-1)] truncate leading-tight">{item.fileName}</p>
                  <p className="text-[8px] text-[var(--text-3)] mt-0.5">{timeAgo(item.timestamp)}</p>
                  {diff && (
                    <span className={`inline-block mt-1 text-[8px] px-1.5 py-0.5 rounded tracking-wider ${cls}`}>
                      {diff}
                    </span>
                  )}
                </div>

                {/* Delete */}
                <button
                  onClick={(e) => handleDelete(e, item.id)}
                  className="opacity-0 group-hover:opacity-100 self-start mt-0.5 text-[var(--text-3)] hover:text-red-400 transition-all p-0.5"
                  title="Delete"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                </button>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
