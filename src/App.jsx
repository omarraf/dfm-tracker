import { useState, useRef, useCallback } from 'react'
import Viewer3D from './components/Viewer3D'
import Viewer2D from './components/Viewer2D'
import RightPanel from './components/RightPanel'
import { analyzeWithClaude } from './lib/anthropicClient'
import { saveAnalysis } from './lib/db'

export default function App() {
  const [fileType, setFileType]           = useState(null)   // 'step' | 'dxf' | null
  const [modelBuffer, setModelBuffer]     = useState(null)   // ArrayBuffer for STEP
  const [dxfText, setDxfText]             = useState(null)   // string for DXF
  const [fileName, setFileName]           = useState(null)
  const [isParsing, setIsParsing]         = useState(false)
  const [modelReady, setModelReady]       = useState(false)
  const [isAnalyzing, setIsAnalyzing]     = useState(false)
  const [screenshots, setScreenshots]     = useState([])
  const [result, setResult]               = useState(null)
  const [error, setError]                 = useState(null)
  const [geometryStats, setGeometryStats] = useState(null)
  // Persisted preferences — intentionally not reset between files
  const [material, setMaterial]           = useState('Aluminium 6061')
  const [thickness, setThickness]         = useState('3')
  // When loading from history we have results/screenshots but no live 3D model
  const [historyMode, setHistoryMode]     = useState(false)
  const viewerRef = useRef(null)

  const reset = useCallback(() => {
    setFileType(null)
    setModelBuffer(null)
    setDxfText(null)
    setFileName(null)
    setIsParsing(false)
    setModelReady(false)
    setIsAnalyzing(false)
    setScreenshots([])
    setResult(null)
    setError(null)
    setGeometryStats(null)
    setHistoryMode(false)
  }, [])

  const handleFile = useCallback((file) => {
    if (!file) return
    const isDxf  = file.name.toLowerCase().endsWith('.dxf')
    const type   = isDxf ? 'dxf' : 'step'

    setFileType(type)
    setFileName(file.name)
    setResult(null)
    setScreenshots([])
    setError(null)
    setModelReady(false)
    setHistoryMode(false)
    setIsParsing(true)
    // Clear the opposite type's data
    if (isDxf) setModelBuffer(null)
    else        setDxfText(null)

    const reader = new FileReader()
    if (isDxf) {
      reader.onload  = (e) => setDxfText(e.target.result)
      reader.onerror = () => { setIsParsing(false); setError('Failed to read DXF file') }
      reader.readAsText(file)
    } else {
      reader.onload  = (e) => setModelBuffer(e.target.result)
      reader.onerror = () => { setIsParsing(false); setError('Failed to read file') }
      reader.readAsArrayBuffer(file)
    }
  }, [])

  const handleModelLoaded = useCallback((stats) => {
    setIsParsing(false)
    setModelReady(true)
    setGeometryStats(stats)
  }, [])

  const handleParseError = useCallback((msg) => {
    setIsParsing(false)
    setModelReady(false)
    setError(msg)
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!viewerRef.current) return
    setIsAnalyzing(true)
    setError(null)

    try {
      const { shots, dims } = await viewerRef.current.captureScreenshots()
      setScreenshots(shots)
      const data = await analyzeWithClaude(shots, dims, geometryStats, material, fileType, thickness)
      setResult(data)

      try {
        await saveAnalysis({ fileName, fileBuffer: modelBuffer, screenshots: shots, result: data })
        window.__dfmHistoryRefresh?.()
      } catch (_) {}
    } catch (err) {
      setError(err.message)
    } finally {
      setIsAnalyzing(false)
    }
  }, [fileName, modelBuffer, geometryStats, material, fileType, thickness])

  const handleHistoryLoad = useCallback((item) => {
    reset()
    setTimeout(() => {
      setFileName(item.fileName)
      setScreenshots(item.screenshots ?? [])
      setResult(item.result ?? null)
      setHistoryMode(true)
      if (item.fileBuffer) {
        setModelBuffer(item.fileBuffer)
        setFileType('step')
        setIsParsing(true)
        setModelReady(false)
        setHistoryMode(false)
      }
    }, 0)
  }, [reset])

  const hasModel   = modelReady && !isParsing
  const hasContent = hasModel || historyMode
  const isLoaded   = hasContent || isParsing || !!modelBuffer || !!dxfText

  return (
    <div className="grid-bg flex flex-col h-screen overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-amber-500">
            <rect x="2" y="2" width="16" height="16" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M6 8h8M6 10h5M6 12h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="15" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
          <span className="font-display text-sm font-semibold tracking-[0.12em] text-[var(--text-1)] uppercase">
            DFM Checker
          </span>
          <span className="text-[9px] font-mono text-[var(--text-3)] tracking-widest uppercase border border-[var(--border)] px-1.5 py-0.5 rounded">
            CNC · Laser · Waterjet
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[10px] text-[var(--text-3)] font-mono">
            {isParsing && (
              <span className="flex items-center gap-1.5 text-amber-500">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dot-1 inline-block"/>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dot-2 inline-block"/>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dot-3 inline-block"/>
                PARSING
              </span>
            )}
            {isAnalyzing && (
              <span className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 dot-1 inline-block"/>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 dot-2 inline-block"/>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 dot-3 inline-block"/>
                ANALYZING
              </span>
            )}
            {hasModel && !isAnalyzing && !isParsing && (
              <span className="text-green-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>
                {fileName}
              </span>
            )}
            {historyMode && (
              <span className="text-[var(--text-3)] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-3)] inline-block"/>
                {fileName}
              </span>
            )}
            {!modelBuffer && !dxfText && !isParsing && !historyMode && (
              <span className="text-[var(--text-3)]">AWAITING INPUT</span>
            )}
          </div>

          {isLoaded && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-2)] hover:text-[var(--text-1)] border border-[var(--border)] hover:border-[var(--text-3)] px-2.5 py-1.5 rounded transition-all"
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              New Analysis
            </button>
          )}
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Viewport */}
        <div className="flex-1 relative border-r border-[var(--border)] min-w-0">

          {/* Always mount both viewers but only show the active one */}
          <div className={fileType === 'dxf' ? 'w-full h-full' : 'hidden'}>
            <Viewer2D
              ref={fileType === 'dxf' ? viewerRef : null}
              dxfText={dxfText}
              onModelLoaded={handleModelLoaded}
              onError={handleParseError}
            />
          </div>
          <div className={fileType !== 'dxf' ? 'w-full h-full' : 'hidden'}>
            <Viewer3D
              ref={fileType !== 'dxf' ? viewerRef : null}
              modelBuffer={modelBuffer}
              onModelLoaded={handleModelLoaded}
              onError={handleParseError}
            />
          </div>

          {!modelBuffer && !dxfText && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-4 opacity-8">
                  <svg viewBox="0 0 64 64" fill="none">
                    <path d="M32 4L60 20V44L32 60L4 44V20L32 4Z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M32 4V60M4 20L60 44M60 20L4 44" stroke="currentColor" strokeWidth="1"/>
                  </svg>
                </div>
                <p className="text-[10px] text-[var(--text-3)] tracking-widest uppercase">
                  Upload a STEP or DXF file to begin
                </p>
              </div>
            </div>
          )}

          <div className="absolute bottom-3 left-3 text-[9px] text-[var(--text-3)] font-mono tracking-widest uppercase pointer-events-none">
            {fileType === 'dxf'
              ? '2D Profile Viewer'
              : '3D Viewport · Orbit: drag · Zoom: scroll'}
          </div>
        </div>

        {/* Right: Controls panel */}
        <RightPanel
          fileName={fileName}
          fileType={fileType}
          hasModel={hasModel}
          historyMode={historyMode}
          isAnalyzing={isAnalyzing}
          screenshots={screenshots}
          result={result}
          error={error}
          geometryStats={geometryStats}
          material={material}
          thickness={thickness}
          onFileSelect={handleFile}
          onAnalyze={handleAnalyze}
          onMaterialChange={setMaterial}
          onThicknessChange={setThickness}
          onHistoryLoad={handleHistoryLoad}
        />
      </div>
    </div>
  )
}
