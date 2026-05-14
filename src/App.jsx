import { useState, useRef, useCallback } from 'react'
import Viewer3D from './components/Viewer3D'
import RightPanel from './components/RightPanel'
import { analyzeWithClaude } from './lib/anthropicClient'

export default function App() {
  const [modelBuffer, setModelBuffer] = useState(null)
  const [fileName, setFileName]       = useState(null)
  const [isParsing, setIsParsing]     = useState(false)
  const [modelReady, setModelReady]   = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [screenshots, setScreenshots] = useState([])
  const [result, setResult]           = useState(null)
  const [error, setError]             = useState(null)
  const viewerRef = useRef(null)

  const handleFile = useCallback((file) => {
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setScreenshots([])
    setError(null)
    setModelReady(false)
    setIsParsing(true)

    const reader = new FileReader()
    reader.onload = (e) => setModelBuffer(e.target.result)
    reader.onerror = () => { setIsParsing(false); setError('Failed to read file') }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleModelLoaded = useCallback(() => {
    setIsParsing(false)
    setModelReady(true)
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
      const caps = await viewerRef.current.captureScreenshots()
      setScreenshots(caps)
      const data = await analyzeWithClaude(caps)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  const hasModel = modelReady && !isParsing

  return (
    <div className="grid-bg flex flex-col h-screen overflow-hidden">
      {/* Header */}
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
            CNC Analyzer
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-3)] font-mono">
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
              ANALYZING GEOMETRY
            </span>
          )}
          {hasModel && !isAnalyzing && !isParsing && (
            <span className="text-green-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>
              MODEL LOADED — {fileName}
            </span>
          )}
          {!modelBuffer && !isParsing && (
            <span className="text-[var(--text-3)]">AWAITING INPUT</span>
          )}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: 3D Viewport */}
        <div className="flex-1 relative border-r border-[var(--border)] min-w-0">
          <Viewer3D
            ref={viewerRef}
            modelBuffer={modelBuffer}
            onModelLoaded={handleModelLoaded}
            onError={handleParseError}
          />
          {!modelBuffer && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 opacity-10">
                  <svg viewBox="0 0 64 64" fill="none">
                    <path d="M32 4L60 20V44L32 60L4 44V20L32 4Z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M32 4V60M4 20L60 44M60 20L4 44" stroke="currentColor" strokeWidth="1"/>
                  </svg>
                </div>
                <p className="text-[10px] text-[var(--text-3)] tracking-widest uppercase">Upload a STEP file to begin</p>
              </div>
            </div>
          )}
          {/* Viewport label */}
          <div className="absolute bottom-3 left-3 text-[9px] text-[var(--text-3)] font-mono tracking-widest uppercase pointer-events-none">
            3D Viewport · Orbit: drag · Zoom: scroll
          </div>
        </div>

        {/* Right: Controls panel */}
        <RightPanel
          fileName={fileName}
          hasModel={hasModel}
          isAnalyzing={isAnalyzing}
          screenshots={screenshots}
          result={result}
          error={error}
          onFileSelect={handleFile}
          onAnalyze={handleAnalyze}
        />
      </div>
    </div>
  )
}
