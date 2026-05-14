const SYSTEM_PROMPT = `You are a senior CNC machinist and DFM (Design for Manufacturability) engineer with 20+ years of experience operating 3-, 4-, and 5-axis machining centers. You are reviewing a mechanical part for manufacturability based on rendered images from multiple angles.

The part's bounding box dimensions in mm will be provided. Use these to reason about wall thickness, pocket depth, hole diameters, and feature sizes relative to standard tooling.

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
  "summary": "<2-3 sentence paragraph written as a machinist evaluating the part — note the material assumption, key setup challenges, and overall verdict>"
}

Scoring guide:
- complexity_score 1: simple block with basic features
- complexity_score 2: multiple faces, simple pockets
- complexity_score 3: compound curves, angled features
- complexity_score 4: undercuts, multi-setup required
- complexity_score 5: complex sculptured surfaces, 5-axis required

If no issues are present, return an empty array for flagged_issues.`

export async function analyzeWithClaude(screenshots, dimensions) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'No API key found. Create a .env file with VITE_ANTHROPIC_API_KEY=your-key-here and restart the dev server.'
    )
  }

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
    ? `Part bounding box: ${dimensions.x} × ${dimensions.y} × ${dimensions.z} mm (X × Y × Z)\n\n`
    : ''

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
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
              text: `${dimsText}Analyze this CNC part for DFM concerns. Identify all manufacturability issues and return your assessment as JSON.`,
            },
          ],
        },
      ],
    }),
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

  // Strip potential markdown code fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude returned an unexpected format. Check the console.')

  return JSON.parse(jsonMatch[0])
}
