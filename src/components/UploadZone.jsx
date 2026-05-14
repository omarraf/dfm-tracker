import { useRef, useState, useCallback } from 'react'

const ACCEPTED = ['.step', '.stp', '.STEP', '.STP']

export default function UploadZone({ onFile, disabled, compact = false }) {
  const inputRef  = useRef(null)
  const [dragging, setDragging] = useState(false)

  const pick = useCallback((file) => {
    if (!file) return
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!ACCEPTED.map(e => e.toLowerCase()).includes(ext)) {
      alert('Please upload a STEP (.step / .stp) file.')
      return
    }
    onFile(file)
  }, [onFile])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    pick(e.dataTransfer.files[0])
  }, [pick, disabled])

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }, [disabled])

  const onDragLeave = useCallback(() => setDragging(false), [])
  const onClick = useCallback(() => { if (!disabled) inputRef.current?.click() }, [disabled])

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={onClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
        className={`
          relative cursor-pointer select-none rounded border border-dashed
          flex items-center gap-2 px-3 py-2 transition-all duration-200
          ${dragging
            ? 'border-amber-500 bg-amber-500/5 text-amber-500'
            : 'border-[var(--border)] hover:border-[var(--text-3)] text-[var(--text-3)] hover:text-[var(--text-2)]'
          }
          ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        `}
      >
        <input ref={inputRef} type="file" accept=".step,.stp" className="hidden"
          onChange={(e) => pick(e.target.files[0])} disabled={disabled} />
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M5.5 1v7M2.5 3.5l3-3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M1 10h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <span className="text-[9px] tracking-wider">
          {dragging ? 'Drop file' : 'Upload different file'}
        </span>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={onClick}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`
        bracket-card relative cursor-pointer select-none rounded
        border border-dashed transition-all duration-200
        flex flex-col items-center justify-center gap-2 py-5 px-4
        ${dragging
          ? 'border-amber-500 bg-amber-500/5'
          : 'border-[var(--border)] hover:border-[var(--text-3)] bg-[var(--bg-1)]'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input ref={inputRef} type="file" accept=".step,.stp" className="hidden"
        onChange={(e) => pick(e.target.files[0])} disabled={disabled} />

      <svg width="28" height="28" viewBox="0 0 28 28" fill="none"
        className={`transition-colors ${dragging ? 'text-amber-500' : 'text-[var(--text-3)]'}`}>
        <path d="M14 4v14M9 9l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M4 20v2a2 2 0 002 2h16a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M8 14a6 6 0 0012 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeDasharray="2 2"/>
      </svg>

      <div className="text-center">
        <p className="text-[11px] text-[var(--text-2)]">
          {dragging ? 'Drop to load' : 'Upload STEP file'}
        </p>
        <p className="text-[9px] text-[var(--text-3)] mt-0.5 tracking-wider">
          .STEP · .STP — drag & drop or click
        </p>
      </div>
    </div>
  )
}
