import DxfParser from 'dxf-parser'

function dist(p1, p2) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

function expandBB(bb, x, y) {
  if (x < bb.minX) bb.minX = x
  if (x > bb.maxX) bb.maxX = x
  if (y < bb.minY) bb.minY = y
  if (y > bb.maxY) bb.maxY = y
}

function arcLengthDeg(startDeg, endDeg, r) {
  let span = endDeg - startDeg
  if (span <= 0) span += 360
  return (span / 360) * 2 * Math.PI * r
}

// Radius and arc length for a LWPOLYLINE bulge segment
function bulgeArcRadius(p1, p2, bulge) {
  const d = dist(p1, p2)
  if (d < 1e-10) return { r: 0, len: 0 }
  const halfAngle = 2 * Math.atan(Math.abs(bulge))
  const r = d / (2 * Math.sin(halfAngle))
  const len = 2 * halfAngle * r          // included angle (radians) × radius
  return { r, len }
}

export function parseDxf(text) {
  const parser = new DxfParser()
  const dxf = parser.parseSync(text)

  const entities = dxf.entities || []

  const bb = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  let totalCutLength  = 0
  let circleCount     = 0
  let minCircleRadius = Infinity
  let minArcRadius    = Infinity   // from ARC entities and LWPOLYLINE bulge arcs
  let closedPolyCount = 0

  for (const e of entities) {
    switch (e.type) {

      case 'LINE': {
        const v = e.vertices || []
        if (v.length < 2) break
        expandBB(bb, v[0].x, v[0].y)
        expandBB(bb, v[1].x, v[1].y)
        totalCutLength += dist(v[0], v[1])
        break
      }

      case 'ARC': {
        // BBox over-estimated as full circle — fine for layout purposes
        expandBB(bb, e.center.x - e.radius, e.center.y - e.radius)
        expandBB(bb, e.center.x + e.radius, e.center.y + e.radius)
        totalCutLength += arcLengthDeg(e.startAngle, e.endAngle, e.radius)
        minArcRadius = Math.min(minArcRadius, e.radius)
        break
      }

      case 'CIRCLE': {
        expandBB(bb, e.center.x - e.radius, e.center.y - e.radius)
        expandBB(bb, e.center.x + e.radius, e.center.y + e.radius)
        totalCutLength += 2 * Math.PI * e.radius
        circleCount++
        minCircleRadius = Math.min(minCircleRadius, e.radius)
        break
      }

      case 'LWPOLYLINE': {
        const verts = e.vertices || []
        for (const v of verts) expandBB(bb, v.x, v.y)
        const n = verts.length
        for (let i = 0; i < n; i++) {
          if (!e.closed && i === n - 1) break
          const v1 = verts[i]
          const v2 = verts[(i + 1) % n]
          const bulge = v1.bulge || 0
          if (Math.abs(bulge) < 1e-8) {
            totalCutLength += dist(v1, v2)
          } else {
            const { r, len } = bulgeArcRadius(v1, v2, bulge)
            totalCutLength += len
            if (r > 0) minArcRadius = Math.min(minArcRadius, r)
          }
        }
        if (e.closed) closedPolyCount++
        break
      }

      case 'POLYLINE': {
        const verts = e.vertices || []
        for (const v of verts) expandBB(bb, v.x, v.y)
        for (let i = 1; i < verts.length; i++) {
          totalCutLength += dist(verts[i - 1], verts[i])
        }
        if (e.closed) closedPolyCount++
        break
      }

      case 'SPLINE': {
        const pts = e.controlPoints || e.fitPoints || []
        for (const p of pts) expandBB(bb, p.x, p.y)
        for (let i = 1; i < pts.length; i++) totalCutLength += dist(pts[i - 1], pts[i])
        break
      }

      case 'ELLIPSE': {
        const rx = e.majorAxisEndPoint
          ? Math.sqrt(e.majorAxisEndPoint.x ** 2 + e.majorAxisEndPoint.y ** 2)
          : 0
        if (e.center && rx > 0) {
          const ry = rx * (e.axisRatio || 1)
          expandBB(bb, e.center.x - rx, e.center.y - ry)
          expandBB(bb, e.center.x + rx, e.center.y + ry)
          totalCutLength += Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)))
        }
        break
      }

      default: break
    }
  }

  // Guard: empty or unrecognised file
  if (!isFinite(bb.minX)) {
    throw new Error('No drawable geometry found in DXF file. Check that the file contains supported entities (LINE, ARC, CIRCLE, LWPOLYLINE).')
  }

  const width  = bb.maxX - bb.minX
  const height = bb.maxY - bb.minY

  return {
    entities,
    bounds: bb,
    stats: {
      widthMm:          Math.round(width  * 10) / 10,
      heightMm:         Math.round(height * 10) / 10,
      totalCutLengthMm: Math.round(totalCutLength),
      circleCount,
      closedPolyCount,
      minHoleDiameterMm: minCircleRadius < Infinity ? Math.round(minCircleRadius * 2 * 10) / 10 : null,
      minArcRadiusMm:    minArcRadius    < Infinity ? Math.round(minArcRadius    * 10) / 10 : null,
      entityCount:       entities.length,
    },
  }
}
