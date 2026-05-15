const SYSTEM_PROMPT = `You are a senior CNC machinist and DFM (Design for Manufacturability) engineer with 20+ years of experience operating 3-, 4-, and 5-axis machining centers. You are reviewing a mechanical part for manufacturability.

You will receive rendered images from multiple angles AND structured geometry measurements extracted directly from the 3D mesh. The measurements are mathematically exact — use them for precise reasoning. Do not contradict them when they clearly indicate an issue (e.g., if downwardFaceRatio is high, undercuts are confirmed; if fillRatio is low, significant pocketing is confirmed).

Geometry measurement guide:
- volumeMm3 / surfaceAreaMm2: actual part volume and surface area
- savRatio (SA / V^⅔): sphere≈4.84, cube≈6. Higher values indicate more complex surface geometry.
- fillRatio (volume / bounding-box volume): >0.8 = near-solid block; 0.5–0.8 = moderate pocketing; <0.5 = heavy pocketing or thin-walled geometry
- downwardFaceRatio: fraction of surface area with face normals pointing downward. >0.15 (15%) indicates significant undercut surfaces that may require a 4th or 5th axis or special fixturing.
- distinctNormalDirections: count of dominant face-orientation clusters (each ≥2% of surface area). ≤3 = very simple, 4–6 = typical multi-face part, >6 suggests complex geometry or many setups.
- bboxVolumeMm3: bounding box volume for context

The part's bounding box dimensions in mm will also be provided. Use them to reason about wall thickness, pocket depth, hole diameters, and feature sizes relative to standard tooling.

Return ONLY a valid JSON object — no markdown, no extra text. Use exactly this structure:

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
  "summary": "<2-3 sentence paragraph written as a machinist evaluating the part — reference the specified material, key setup challenges, and overall verdict>"
}

Scoring guide:
- complexity_score 1: simple block with basic features
- complexity_score 2: multiple faces, simple pockets
- complexity_score 3: compound curves, angled features
- complexity_score 4: undercuts, multi-setup required
- complexity_score 5: complex sculptured surfaces, 5-axis required

If no issues are present, return an empty array for flagged_issues.`

// In development: call Anthropic directly from the browser (needs VITE_ANTHROPIC_API_KEY in .env).
// In production: route through the serverless proxy at /api/analyze (uses ANTHROPIC_API_KEY server-side).
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

export async function analyzeWithClaude(screenshots, dimensions, geometryStats, material = 'Aluminium 6061') {
  const labels = ['Front view', 'Side view', 'Top view', 'Isometric view', 'Bottom view']

  const imageContent = screenshots.flatMap((dataUrl, i) => {
    const base64 = dataUrl.split(',')[1]
    return [
      { type: 'text', text: `**${labels[i] ?? `View ${i + 1}`}:**` },
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: base64 },
      },
    ]
  })

  const dimsText = dimensions
    ? `Part bounding box: ${dimensions.x} × ${dimensions.y} × ${dimensions.z} mm (X × Y × Z)\n`
    : ''

  const materialText = `Material: ${material}\n`

  let statsText = ''
  if (geometryStats) {
    statsText = [
      'Geometry measurements (computed from mesh):',
      `  Volume:                    ${geometryStats.volumeMm3.toLocaleString()} mm³`,
      `  Surface area:              ${geometryStats.surfaceAreaMm2.toLocaleString()} mm²`,
      `  SA/V ratio:                ${geometryStats.savRatio}  (sphere≈4.84, cube≈6)`,
      `  Bounding-box fill ratio:   ${geometryStats.fillRatio}  (1.0=solid block, <0.5=heavy pocketing)`,
      `  Downward-face ratio:       ${(geometryStats.downwardFaceRatio * 100).toFixed(1)}%  (>15% = likely undercuts)`,
      `  Distinct normal clusters:  ${geometryStats.distinctNormalDirections}  (>6 = complex / many setups)`,
      `  Triangle count:            ${geometryStats.triangleCount.toLocaleString()}`,
      '',
    ].join('\n')
  }

  const response = await callApi({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContent,
          {
            type: 'text',
            text: `${materialText}${dimsText}${statsText}\nAnalyze this CNC part for DFM concerns. Identify all manufacturability issues and return your assessment as JSON.`,
          },
        ],
      },
    ],
  })

  if (!response.ok) {
    let msg = response.statusText
    try {
      const err = await response.json()
      msg = err.error?.message || msg
    } catch (_) {}
    throw new Error(`Anthropic API error (${response.status}): ${msg}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text ?? ''

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude returned an unexpected format. Check the console.')

  return JSON.parse(jsonMatch[0])
}
