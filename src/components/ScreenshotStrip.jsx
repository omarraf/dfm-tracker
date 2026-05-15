const LABELS = ['FRONT', 'SIDE', 'TOP', 'ISO']

export default function ScreenshotStrip({ screenshots }) {
  if (!screenshots || screenshots.length === 0) return null

  return (
    <div className="slide-up">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-1 h-1 rounded-full bg-cyan-400 inline-block"/>
        <span className="text-[9px] text-[var(--text-3)] tracking-widest uppercase">
          Capture sent to AI
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {screenshots.map((src, i) => (
          <div key={i} className="relative group">
            <div className="rounded overflow-hidden border border-[var(--border)] aspect-square bg-[var(--bg-1)]">
              <img
                src={src}
                alt={LABELS[i]}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              />
            </div>
            <p className="text-center text-[8px] text-[var(--text-3)] mt-1 tracking-widest">
              {LABELS[i]}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
