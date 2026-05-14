import UploadZone from './UploadZone'
import ScreenshotStrip from './ScreenshotStrip'
import AnalysisResults from './AnalysisResults'

function Separator({ label }) {
  return (
    <div className="flex items-center gap-2 my-3">
      <div className="flex-1 h-px bg-[var(--border)]"/>
      {label && (
        <span className="text-[8px] text-[var(--text-3)] tracking-widest uppercase shrink-0">
          {label}
        </span>
      )}
      <div className="flex-1 h-px bg-[var(--border)]"/>
    </div>
  )
}

export default function RightPanel({
  fileName,
  hasModel,
  isAnalyzing,
  screenshots,
  result,
  error,
  onFileSelect,
  onAnalyze,
}) {
  return (
    <div className="w-80 shrink-0 flex flex-col bg-[var(--bg-1)] overflow-hidden">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <p className="text-[9px] text-[var(--text-3)] tracking-widest uppercase">Control Panel</p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0">

        {/* Upload */}
        <UploadZone onFile={onFileSelect} disabled={isAnalyzing} />

        {/* Analyze button */}
        {hasModel && (
          <>
            <Separator />
            <button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className={`
                w-full relative overflow-hidden rounded
                font-display text-sm font-semibold tracking-[0.08em] uppercase
                transition-all duration-200
                ${isAnalyzing
                  ? 'bg-[var(--bg-2)] text-[var(--text-3)] cursor-not-allowed border border-[var(--border)]'
                  : 'btn-analyze bg-amber-500 text-black hover:bg-amber-400 active:bg-amber-600 border border-amber-600'
                }
                py-2.5
              `}
            >
              {isAnalyzing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 dot-1 inline-block"/>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 dot-2 inline-block"/>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 dot-3 inline-block"/>
                  <span className="text-cyan-400 text-xs tracking-widest">Analyzing geometry…</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M4 6.5h5M7 4.5l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Run DFM Analysis
                </span>
              )}
            </button>
          </>
        )}

        {/* Error */}
        {error && (
          <>
            <Separator />
            <div className="rounded border border-red-500/30 bg-red-500/8 p-3">
              <div className="flex items-start gap-2">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-red-400 mt-0.5 shrink-0">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M6 3.5V6.5M6 8v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <p className="text-[10px] text-red-400 leading-relaxed">{error}</p>
              </div>
            </div>
          </>
        )}

        {/* Screenshot strip */}
        {screenshots.length > 0 && (
          <>
            <Separator label="Sent to Claude" />
            <ScreenshotStrip screenshots={screenshots} />
          </>
        )}

        {/* Results */}
        {result && (
          <>
            <Separator label="DFM Report" />
            <AnalysisResults result={result} />
          </>
        )}

        {/* Empty state hint */}
        {!hasModel && !error && (
          <div className="mt-6 space-y-3">
            <Separator label="How it works" />
            <ol className="space-y-2.5 pl-1">
              {[
                'Upload a STEP or STP file',
                'Part renders in the 3D viewport',
                'Click "Run DFM Analysis"',
                'Claude reviews 4 camera angles',
                'Receive manufacturability report',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="text-[9px] text-amber-500 font-mono shrink-0 mt-0.5">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] text-[var(--text-3)] leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>

            <Separator />
            <div className="rounded border border-[var(--border)] bg-[var(--bg-2)] p-3">
              <p className="text-[9px] text-[var(--text-3)] mb-1.5 tracking-wider uppercase">Required</p>
              <p className="text-[10px] text-[var(--text-2)] leading-relaxed">
                Set <code className="text-amber-500 bg-[var(--bg-3)] px-1 py-0.5 rounded text-[9px]">VITE_ANTHROPIC_API_KEY</code> in a <code className="text-amber-500 bg-[var(--bg-3)] px-1 py-0.5 rounded text-[9px]">.env</code> file before analysis.
              </p>
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[var(--border)] flex items-center justify-between">
        <span className="text-[8px] text-[var(--text-3)] tracking-widest uppercase">
          Powered by Claude Sonnet
        </span>
        {fileName && (
          <span className="text-[8px] text-[var(--text-3)] truncate max-w-[120px]" title={fileName}>
            {fileName}
          </span>
        )}
      </div>
    </div>
  )
}
