// Nova Media — AI creative studio. Text generation via Claude, image generation via Stability AI.
import { setCors } from '../_cors.js'
import { sanitize } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { logEnvCheck } from '../_envCheck.js'
import { callClaude } from '../_agents.js'

// ============================================================ ACTION: generate_caption ========

async function handleGenerateCaption(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const topic = sanitize(b.topic, 500)
  const platform = sanitize(b.platform, 40) || 'instagram'
  const format = sanitize(b.format, 40) || 'post'
  if (!topic) return res.status(400).json({ error: 'topic is required' })

  const systemPrompt = `You write ${platform} ${format} content for Nova Systems, a Connecticut AI company. Generate: a caption (with appropriate tone/emoji for ${platform}), a video script if format suggests video (hook, body, CTA), and a set of 8-12 relevant hashtags. Return ONLY JSON: {"caption": "", "script": "", "hashtags": []}`
  const raw = await callClaude(systemPrompt, topic, { maxTokens: 700, temperature: 0.7 })
  let parsed = { caption: raw || '', script: '', hashtags: [] }
  if (raw) {
    try { const match = raw.match(/\{[\s\S]*\}/); if (match) parsed = JSON.parse(match[0]) } catch { /* keep raw fallback */ }
  }

  if (isSupabaseConfigured()) {
    await supabaseFetch('nova_media_assets', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ type: 'caption', title: topic, content: JSON.stringify(parsed), platform }),
    }).catch(() => {})
  }
  return res.status(200).json({ ok: true, ...parsed })
}

// ============================================================ ACTION: generate_image ===========

async function handleGenerateImage(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const key = process.env.STABILITY_API_KEY
  if (!key) return res.status(500).json({ error: 'STABILITY_API_KEY is not configured' })
  const b = req.body || {}
  const prompt = sanitize(b.prompt, 1000)
  if (!prompt) return res.status(400).json({ error: 'prompt is required' })

  try {
    const r = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ text_prompts: [{ text: prompt }], samples: 1, height: 1024, width: 1024 }),
    })
    if (!r.ok) { const errText = await r.text(); throw new Error(errText) }
    const data = await r.json()
    const base64 = data?.artifacts?.[0]?.base64
    if (!base64) throw new Error('No image returned')
    const dataUrl = `data:image/png;base64,${base64}`

    let saved = null
    if (isSupabaseConfigured()) {
      const asset = await supabaseFetch('nova_media_assets', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ type: 'image', title: prompt.slice(0, 200), image_url: dataUrl }),
      })
      saved = asset.ok ? (await asset.json())[0] : null
    }
    return res.status(200).json({ ok: true, image_data_url: dataUrl, asset: saved })
  } catch (err) {
    console.error('[nova-media:generate_image] Failed:', err.message)
    return res.status(500).json({ error: `Image generation failed: ${err.message}` })
  }
}

// ============================================================ ACTION: generate_calendar ========

async function handleGenerateCalendar(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const industry = sanitize(b.industry, 100) || 'small business'
  const days = Math.min(30, Math.max(1, parseInt(b.days, 10) || 30))

  const systemPrompt = `You are a social media strategist. Generate a ${days}-day content calendar for a ${industry} business. Return ONLY a JSON array of ${days} objects, each with: day (1-${days}), platform, format, topic.`
  const raw = await callClaude(systemPrompt, `Generate the ${days}-day calendar now.`, { maxTokens: 2000, temperature: 0.6 })
  let calendar = []
  if (raw) {
    try { const match = raw.match(/\[[\s\S]*\]/); calendar = JSON.parse(match ? match[0] : raw) } catch (err) { console.error('[nova-media:generate_calendar] Parse failed:', err.message) }
  }
  return res.status(200).json({ ok: true, calendar })
}

// ============================================================ ACTION: get_assets ================

async function handleGetAssets(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const r = await supabaseFetch('nova_media_assets?order=created_at.desc&limit=100')
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Media', ['ANTHROPIC_API_KEY', 'STABILITY_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'generate_caption':  return await handleGenerateCaption(req, res)
      case 'generate_image':    return await handleGenerateImage(req, res)
      case 'generate_calendar': return await handleGenerateCalendar(req, res)
      case 'get_assets':        return await handleGetAssets(req, res)
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Media] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
