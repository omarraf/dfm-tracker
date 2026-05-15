// ── System prompts ────────────────────────────────────────────────────────────

const STEP_SYSTEM_PROMPT = `You are a senior CNC machinist and DFM (Design for Manufacturability) engineer with 20+ years of experience operating 3-, 4-, and 5-axis machining centers. You are reviewing a mechanical part for manufacturability.

You will receive rendered images from multiple angles AND structured geometry measurements extracted directly from the 3D mesh. The measurements are mathematically exact — use them for precise reasoning. Do not contradict them when they clearly indicate an issue (e.g., if downwardFaceRatio is high, undercuts are confirmed; if fillRatio is low, significant pocketing is confirmed).

Geometry measurement guide:
- volumeMm3 / surfaceAreaMm2: actual part volume and surface area
- savRatio (SA / V^⅔): sphere≈4.84, cube≈6. Higher values indicate more complex surface geometry.
- fillRatio (volume / bounding-box volume): >0.8 = near-solid block; 0.5–0.8 = moderate pocketing; <0.5 = heavy pocketing or thin-walled geometry
- downwardFaceRatio: fraction of surface area with face normals pointing downward. >0.15 (15%) indicates significant undercut surfaces.
- distinctNormalDirections: count of dominant face-orientation clusters (≥2% of surface area). ≤3 = very simple, 4–6 = typical, >6 suggests many setups.

The part's bounding box dimensions and selected material will also be provided.

Return ONLY a valid JSON object — no markdown, no extra text:

{
  "complexity_score": <integer 1-5>,
  "machining_difficulty": "<Easy|Medium|Hard|Very Hard>",
  "recommended_axes": "<3-axis|4-axis|5-axis>",
  "lead_time_estimate": "<1-2 days|3-5 days|1-2 weeks|2-4 weeks>",
  "flagged_issues": [
    {
      "type": "<undercuts|thin_walls|deep_pockets|tight_internal_radii|surface_finish|tool_access|fixturing|other>",
      "severity": "<low|medium|high>",
      "description": "<one sentence describing the issue and its location>"
    }
  ],
  "summary": "<2-3 sentence paragraph as a machinist — reference the specified material, key setup challenges, and overall verdict>"
}

Scoring: 1=simple block, 2=multiple faces/pockets, 3=compound curves/angles, 4=undercuts/multi-setup, 5=5-axis sculptured surfaces.
If no issues: return empty array for flagged_issues.`

const DXF_SYSTEM_PROMPT = `You are a senior fabrication engineer with 20+ years of experience in laser cutting, waterjet cutting, and sheet metal fabrication. You are reviewing a 2D flat profile for DFM (Design for Manufacturability) concerns.

You will receive a rendered image of the flat profile AND structured geometry measurements. The material and thickness are specified — use them as the primary reference for all feature-size checks.

Key fabrication rules of thumb:
- Minimum hole diameter ≥ material thickness (laser), ≥ 1.5× thickness (waterjet/plasma)
- Minimum slot width ≥ 1.5× material thickness
- Minimum bridge/tab width between features ≥ 1× material thickness
- Feature-to-edge distance ≥ 1× material thickness
- Very small features (<2 mm) risk positioning and tolerance issues
- Acute internal corners concentrate stress in service; fillets are recommended

Return ONLY a valid JSON object — no markdown, no extra text:

{
  "complexity_score": <integer 1-5>,
  "machining_difficulty": "<Easy|Medium|Hard|Very Hard>",
  "recommended_axes": "2D Flat",
  "lead_time_estimate": "<same day|1-2 days|3-5 days|1-2 weeks>",
  "flagged_issues": [
    {
      "type": "<small_holes|thin_bridges|tight_tolerances|edge_proximity|sharp_corners|complex_profile|other>",
      "severity": "<low|medium|high>",
      "description": "<one sentence describing the issue>"
    }
  ],
  "summary": "<2-3 sentence paragraph as a fabrication engineer — reference the material and thickness, note key concerns, give overall verdict>"
}

Scoring: 1=simple rect+basic holes, 2=regular geometry/standard pattern, 3=complex outline or many features, 4=near-minimum feature sizes, 5=extreme complexity or specialist process required.
If no issues: return empty array for flagged_issues.`

// ── API call (dev: direct browser; prod: /api/analyze proxy) ─────────────────

async function callApi(payload) {
  if (import.meta.env.DEV) {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        'No API key found. Create a .env file with VITE_ANTHROPIC_API_KEY=your-key-here and restart the dev server.'
      )
    }
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(payload),
    })
  }

  return fetch('/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function analyzeWithClaude(
  screenshots,
  dimensions,
  geometryStats,
  material = 'Aluminium 6061',
  fileType = 'step',
  thickness = '3'
) {
  const isDxf = fileType === 'dxf'

  // Image content blocks
  const stepLabels = ['Front view', 'Side view', 'Top view', 'Isometric view', 'Bottom view']
  const imageContent = screenshots.flatMap((dataUrl, i) => {
    const base64 = dataUrl.split(',')[1]
    return [
      { type: 'text', text: `**${isDxf ? 'Flat profile view' : (stepLabels[i] ?? `View ${i + 1}`)}:**` },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
    ]
  })

  // Text context block
  let contextText = `Material: ${material}\n`

  if (isDxf) {
    contextText += `Thickness: ${thickness} mm\n`
    if (geometryStats) {
      contextText += [
        '',
        'Profile geometry measurements:',
        `  Dimensions:         ${geometryStats.widthMm} × ${geometryStats.heightMm} mm`,
        `  Total cut length:   ${geometryStats.totalCutLengthMm?.toLocaleString()} mm`,
        `  Circle count:       ${geometryStats.circleCount ?? 0}`,
        `  Closed profiles:    ${geometryStats.closedPolyCount ?? 0}`,
        geometryStats.minHoleDiameterMm != null
          ? `  Min hole diameter:  ${geometryStats.minHoleDiameterMm} mm  (thickness = ${thickness} mm)`
          : '  Min hole diameter:  none detected',
        geometryStats.minArcRadiusMm != null
          ? `  Min arc/fillet R:   ${geometryStats.minArcRadiusMm} mm`
          : '  Min arc/fillet R:   none detected',
        '',
      ].join('\n')
    }
    contextText += '\nAnalyze this flat profile for fabrication DFM concerns and return your assessment as JSON.'
  } else {
    if (dimensions) {
      contextText += `Part bounding box: ${dimensions.x} × ${dimensions.y} × ${dimensions.z} mm (X × Y × Z)\n`
    }
    if (geometryStats) {
      contextText += [
        '',
        'Geometry measurements (computed from mesh):',
        `  Volume:                    ${geometryStats.volumeMm3?.toLocaleString()} mm³`,
        `  Surface area:              ${geometryStats.surfaceAreaMm2?.toLocaleString()} mm²`,
        `  SA/V ratio:                ${geometryStats.savRatio}  (sphere≈4.84, cube≈6)`,
        `  Bounding-box fill ratio:   ${geometryStats.fillRatio}  (1.0=solid block, <0.5=heavy pocketing)`,
        `  Downward-face ratio:       ${((geometryStats.downwardFaceRatio ?? 0) * 100).toFixed(1)}%  (>15% = likely undercuts)`,
        `  Distinct normal clusters:  ${geometryStats.distinctNormalDirections}  (>6 = complex / many setups)`,
        `  Triangle count:            ${geometryStats.triangleCount?.toLocaleString()}`,
        '',
      ].join('\n')
    }
    contextText += '\nAnalyze this CNC part for DFM concerns. Identify all manufacturability issues and return your assessment as JSON.'
  }

  const response = await callApi({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: isDxf ? DXF_SYSTEM_PROMPT : STEP_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [...imageContent, { type: 'text', text: contextText }],
      },
    ],
  })

  if (!response.ok) {
    let msg = response.statusText
    try { const err = await response.json(); msg = err.error?.message || msg } catch (_) {}
    throw new Error(`Anthropic API error (${response.status}): ${msg}`)
  }

  const data  = await response.json()
  const text  = data.content?.[0]?.text ?? ''
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI returned an unexpected format. Check the console.')

  return JSON.parse(match[0])
}
