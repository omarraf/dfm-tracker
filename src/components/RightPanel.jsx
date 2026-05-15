import UploadZone from './UploadZone'
import ScreenshotStrip from './ScreenshotStrip'
import AnalysisResults from './AnalysisResults'
import GeometryStats from './GeometryStats'
import HistoryPanel from './HistoryPanel'

const MATERIALS = [
  'Aluminium 6061',
  'Aluminium 7075',
  'Stainless Steel 304',
  'Stainless Steel 316',
  'Mild Steel',
  'Titanium 6Al-4V',
  'Brass',
  'Delrin (POM)',
  'PEEK',
  'ABS',
]

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
  historyMode,
  isAnalyzing,
  screenshots,
  result,
  error,
  geometryStats,
  material,
  onFileSelect,
  onAnalyze,
  onMaterialChange,
  onHistoryLoad,
}) {
  const showUpload   = !hasModel && !historyMode
  const showAnalyze  = hasModel && !historyMode
  const hasResults   = screenshots.length > 0 || result

  return (
    <div className="w-80 shrink-0 flex flex-col bg-[var(--bg-1)] overflow-hidden">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <p className="text-[9px] text-[var(--text-3)] tracking-widest uppercase">Control Panel</p>
        {(hasModel || historyMode) && (
          <button
            onClick={() => document.querySelector('input[type=file]')?.click()}
            disabled={isAnalyzing}
            className="text-[9px] text-[var(--text-3)] hover:text-amber-500 flex items-center gap-1 transition-colors disabled:opacity-40"
            title="Upload a different file"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M4.5 1v6M2 3.5l2.5-2.5 2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 8h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Upload new
            {/* Hidden file input so the button can trigger it */}
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-3">

        {/* Upload zone — shown when idle or after reset */}
        {showUpload && (
          <UploadZone onFile={onFileSelect} disabled={isAnalyzing} />
        )}

        {/* Currently loaded file indicator when model is live */}
        {(hasModel || historyMode) && (
          <div className="bracket-card rounded bg-[var(--bg-2)] border border-[var(--border)] px-3 py-2 flex items-center gap-2.5">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-amber-500 shrink-0">
              <path d="M2 2h5l3 3v5H2V2z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
              <path d="M7 2v3h3" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
            </svg>
            <span className="text-[10px] text-[var(--text-2)] truncate flex-1" title={fileName}>
              {fileName}
            </span>
            {historyMode && (
              <span className="text-[8px] text-[var(--text-3)] tracking-wider shrink-0">HISTORY</span>
            )}
          </div>
        )}

        {/* Swap file button — visible when something is loaded */}
        {(hasModel || historyMode) && !isAnalyzing && (
          <div className="mt-2">
            <UploadZone onFile={onFileSelect} disabled={isAnalyzing} compact />
          </div>
        )}

        {/* Geometry stats — shown as soon as model is parsed */}
        {geometryStats && (
          <>
            <Separator label="Geometry" />
            <GeometryStats stats={geometryStats} />
          </>
        )}

        {/* Material selector — visible whenever a model is live */}
        {showAnalyze && (
          <>
            <Separator label="Material" />
            <div className="relative">
              <select
                value={material}
                onChange={(e) => onMaterialChange(e.target.value)}
                disabled={isAnalyzing}
                className="w-full appearance-none bg-[var(--bg-2)] border border-[var(--border)] rounded px-2.5 py-2 pr-8 text-[11px] text-[var(--text-1)] font-mono cursor-pointer transition-colors hover:border-[var(--text-3)] focus:outline-none focus:border-[var(--text-3)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-3)]"
              >
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </>
        )}

        {/* Analyze button */}
        {showAnalyze && (
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
            <div className="rounded border border-red-500/30 bg-red-500/5 p-3">
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

        {/* Screenshots + Results */}
        {hasResults && (
          <>
            {screenshots.length > 0 && (
              <>
                <Separator label="Sent to Claude" />
                <ScreenshotStrip screenshots={screenshots} />
              </>
            )}
            {result && (
              <>
                <Separator label="DFM Report" />
                <AnalysisResults result={result} />
              </>
            )}
          </>
        )}

        {/* Empty state: how-it-works */}
        {showUpload && !error && (
          <div className="mt-4 space-y-3">
            <Separator label="How it works" />
            <ol className="space-y-2 pl-1">
              {[
                'Upload a STEP or STP file',
                'Part renders in the 3D viewport',
                'Click "Run DFM Analysis"',
                'Claude reviews 5 camera angles + mesh stats',
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
            {import.meta.env.DEV && (
              <>
                <Separator />
                <div className="rounded border border-[var(--border)] bg-[var(--bg-2)] p-3">
                  <p className="text-[9px] text-[var(--text-3)] mb-1 tracking-wider uppercase">Local dev</p>
                  <p className="text-[10px] text-[var(--text-2)] leading-relaxed">
                    Set <code className="text-amber-500 bg-[var(--bg-3)] px-1 py-0.5 rounded text-[9px]">VITE_ANTHROPIC_API_KEY</code> in a <code className="text-amber-500 bg-[var(--bg-3)] px-1 py-0.5 rounded text-[9px]">.env</code> file.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* History */}
        <Separator />
        <HistoryPanel onLoad={onHistoryLoad} />

        <div className="h-4" />
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[var(--border)] flex items-center justify-between shrink-0">
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
