import { forwardRef, useEffect, useRef, useImperativeHandle, useCallback } from 'react'
import { parseDxf } from '../lib/parseDxf'

// ── Canvas drawing helpers ────────────────────────────────────────────────────

function makeTransform(bb, W, H) {
  const pad = Math.min(W, H) * 0.08
  const bW  = bb.maxX - bb.minX || 1
  const bH  = bb.maxY - bb.minY || 1
  const scale = Math.min((W - pad * 2) / bW, (H - pad * 2) / bH)
  const offsetX = (W - bW * scale) / 2
  const offsetY = (H - bH * scale) / 2
  const toCanvas = (x, y) => ({
    x: (x - bb.minX) * scale + offsetX,
    y: H - ((y - bb.minY) * scale + offsetY),  // flip Y: DXF is Y-up
  })
  toCanvas.scale = scale
  return toCanvas
}

// Draw a bulge arc segment (LWPOLYLINE) from v1 to v2
function drawBulgeArc(ctx, v1, v2, bulge, toC) {
  const dx = v2.x - v1.x, dy = v2.y - v1.y
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d < 1e-10) return

  const halfAngle = 2 * Math.atan(Math.abs(bulge))
  const r = d / (2 * Math.sin(halfAngle))
  const mx = (v1.x + v2.x) / 2, my = (v1.y + v2.y) / 2
  const px = -dy / d, py = dx / d
  const h = r * Math.cos(halfAngle)
  const sign = bulge > 0 ? 1 : -1
  const cx = mx + sign * h * px, cy = my + sign * h * py

  const a1 = Math.atan2(v1.y - cy, v1.x - cx)
  const a2 = Math.atan2(v2.y - cy, v2.x - cx)
  const cc = toC(cx, cy)
  // positive bulge = CCW in DXF; after Y-flip, CCW in DXF = visually CCW on screen = anticlockwise:true
  ctx.arc(cc.x, cc.y, r * toC.scale, -a1, -a2, bulge > 0)
}

function drawEntity(ctx, entity, toC) {
  switch (entity.type) {

    case 'LINE': {
      const v = entity.vertices || []
      if (v.length < 2) return
      const p1 = toC(v[0].x, v[0].y), p2 = toC(v[1].x, v[1].y)
      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.stroke()
      break
    }

    case 'ARC': {
      const c = toC(entity.center.x, entity.center.y)
      const r = entity.radius * toC.scale
      // DXF angles are degrees, CCW from +X. After Y-flip, use anticlockwise:true.
      const a1 = -entity.startAngle * Math.PI / 180
      const a2 = -entity.endAngle   * Math.PI / 180
      ctx.beginPath()
      ctx.arc(c.x, c.y, r, a1, a2, true)
      ctx.stroke()
      break
    }

    case 'CIRCLE': {
      const c = toC(entity.center.x, entity.center.y)
      ctx.beginPath()
      ctx.arc(c.x, c.y, entity.radius * toC.scale, 0, 2 * Math.PI)
      ctx.stroke()
      break
    }

    case 'LWPOLYLINE': {
      const verts = entity.vertices || []
      if (verts.length === 0) return
      ctx.beginPath()
      const p0 = toC(verts[0].x, verts[0].y)
      ctx.moveTo(p0.x, p0.y)
      const n = verts.length
      for (let i = 0; i < n; i++) {
        if (!entity.closed && i === n - 1) break
        const v1 = verts[i], v2 = verts[(i + 1) % n]
        const bulge = v1.bulge || 0
        if (Math.abs(bulge) < 1e-8) {
          const p = toC(v2.x, v2.y)
          ctx.lineTo(p.x, p.y)
        } else {
          drawBulgeArc(ctx, v1, v2, bulge, toC)
        }
      }
      if (entity.closed) ctx.closePath()
      ctx.stroke()
      break
    }

    case 'POLYLINE': {
      const verts = entity.vertices || []
      if (verts.length === 0) return
      ctx.beginPath()
      const p0 = toC(verts[0].x, verts[0].y)
      ctx.moveTo(p0.x, p0.y)
      for (let i = 1; i < verts.length; i++) {
        const p = toC(verts[i].x, verts[i].y)
        ctx.lineTo(p.x, p.y)
      }
      if (entity.closed) ctx.closePath()
      ctx.stroke()
      break
    }

    case 'SPLINE': {
      const pts = (entity.controlPoints || entity.fitPoints || [])
      if (pts.length < 2) return
      ctx.beginPath()
      const p0 = toC(pts[0].x, pts[0].y)
      ctx.moveTo(p0.x, p0.y)
      for (let i = 1; i < pts.length; i++) {
        const p = toC(pts[i].x, pts[i].y)
        ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
      break
    }

    case 'ELLIPSE': {
      if (!entity.center || !entity.majorAxisEndPoint) return
      const c = toC(entity.center.x, entity.center.y)
      const rx = Math.sqrt(
        entity.majorAxisEndPoint.x ** 2 + entity.majorAxisEndPoint.y ** 2
      ) * toC.scale
      const ry = rx * (entity.axisRatio || 1)
      const rotation = Math.atan2(entity.majorAxisEndPoint.y, entity.majorAxisEndPoint.x)
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, rx, ry, -rotation, 0, 2 * Math.PI)
      ctx.stroke()
      break
    }

    default: break
  }
}

function renderParsed(canvas, parsed) {
  const { entities, bounds } = parsed
  const W = canvas.width, H = canvas.height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#07090b'
  ctx.fillRect(0, 0, W, H)

  const toC   = makeTransform(bounds, W, H)
  ctx.strokeStyle = '#c8dae8'
  ctx.lineWidth   = 1.2
  ctx.lineCap     = 'round'
  ctx.lineJoin    = 'round'

  for (const entity of entities) drawEntity(ctx, entity, toC)

  // Dimension labels
  const { stats } = parsed
  if (stats) {
    ctx.fillStyle   = 'rgba(62, 70, 84, 0.9)'
    ctx.font        = '10px "JetBrains Mono", monospace'
    ctx.fillText(`${stats.widthMm} × ${stats.heightMm} mm`, 10, H - 10)
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const Viewer2D = forwardRef(function Viewer2D({ dxfText, onModelLoaded, onError }, ref) {
  const wrapRef   = useRef(null)
  const canvasRef = useRef(null)
  const parsedRef = useRef(null)

  // Parse + render when dxfText changes
  useEffect(() => {
    if (!dxfText) return
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      const parsed = parseDxf(dxfText)
      parsedRef.current = parsed

      canvas.width  = canvas.offsetWidth  || 800
      canvas.height = canvas.offsetHeight || 600
      renderParsed(canvas, parsed)

      onModelLoaded?.(parsed.stats)
    } catch (err) {
      onError?.(err.message || 'Failed to parse DXF file')
    }
  }, [dxfText, onModelLoaded, onError])

  // Resize observer — re-render when the container changes size
  useEffect(() => {
    const wrap   = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    const ro = new ResizeObserver(() => {
      canvas.width  = wrap.clientWidth
      canvas.height = wrap.clientHeight
      if (parsedRef.current) renderParsed(canvas, parsedRef.current)
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  const captureScreenshots = useCallback(() => {
    const parsed = parsedRef.current
    if (!parsed) throw new Error('No DXF loaded.')

    const off    = document.createElement('canvas')
    off.width    = 800
    off.height   = 800
    renderParsed(off, parsed)

    const { stats } = parsed
    const dims = stats ? { x: stats.widthMm, y: stats.heightMm, z: 0 } : null
    return { shots: [off.toDataURL('image/png')], dims, geometryStats: stats }
  }, [])

  useImperativeHandle(ref, () => ({ captureScreenshots }), [captureScreenshots])

  return (
    <div ref={wrapRef} className="w-full h-full">
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  )
})

export default Viewer2D
