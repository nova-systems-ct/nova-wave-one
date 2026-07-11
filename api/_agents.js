// Shared agent / knowledge-base loading and Claude access, used by every engine that needs an
// AI-generated reply (SMS, WhatsApp, Email, Voice, Social) so the knowledge-base-to-system-prompt
// mapping is identical everywhere instead of drifting per engine.
import Anthropic from '@anthropic-ai/sdk'
import { supabaseFetch, isSupabaseConfigured } from './_supabaseAdmin.js'

export async function loadAgentByPhone(phoneNumber) {
  if (!phoneNumber || !isSupabaseConfigured()) return null
  try {
    const r = await supabaseFetch(`nova_ai_agents?phone_number=eq.${encodeURIComponent(phoneNumber)}&limit=1`)
    const rows = r.ok ? await r.json() : []
    return rows[0] || null
  } catch (err) {
    console.error('[agents:loadAgentByPhone] Failed:', err.message)
    return null
  }
}

export async function loadAgentById(agentId) {
  if (!agentId || !isSupabaseConfigured()) return null
  try {
    const r = await supabaseFetch(`nova_ai_agents?id=eq.${encodeURIComponent(agentId)}&limit=1`)
    const rows = r.ok ? await r.json() : []
    return rows[0] || null
  } catch (err) {
    console.error('[agents:loadAgentById] Failed:', err.message)
    return null
  }
}

export async function loadAgentByMetaAccount(metaAccountId) {
  if (!metaAccountId || !isSupabaseConfigured()) return null
  try {
    const r = await supabaseFetch(`nova_ai_agents?meta_account_id=eq.${encodeURIComponent(metaAccountId)}&limit=1`)
    const rows = r.ok ? await r.json() : []
    return rows[0] || null
  } catch (err) {
    console.error('[agents:loadAgentByMetaAccount] Failed:', err.message)
    return null
  }
}

export async function loadKnowledgeBase(agentId) {
  if (!agentId || !isSupabaseConfigured()) return null
  try {
    const r = await supabaseFetch(`nova_ai_knowledge_bases?agent_id=eq.${encodeURIComponent(agentId)}&limit=1`)
    const rows = r.ok ? await r.json() : []
    return rows[0] || null
  } catch (err) {
    console.error('[agents:loadKnowledgeBase] Failed:', err.message)
    return null
  }
}

// channelInstructions is the tail of the prompt that differs per channel (SMS keeps it under 160
// chars, voice keeps it to 1-2 spoken sentences, social uses emoji, email is more formal, etc).
export function buildSystemPrompt(agent, kb, channelInstructions) {
  const businessName = kb?.business_name || agent?.business_name || 'this business'
  const agentName = agent?.agent_name || 'Nova'
  if (!kb) {
    return `You are ${agentName}, a virtual assistant for ${businessName}. ${channelInstructions} Never say you are an AI unless directly asked.`
  }
  const faqLines = Array.isArray(kb.faqs) ? kb.faqs.filter((f) => f?.q).map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n') : ''
  return [
    `You are ${agentName}, a virtual assistant for ${businessName}.`,
    kb.business_description || '',
    kb.services ? `Services and pricing: ${kb.services}` : '',
    kb.hours ? `Hours: ${kb.hours}` : '',
    kb.address ? `Address: ${kb.address}` : '',
    kb.booking_process ? `Booking process: ${kb.booking_process}` : '',
    faqLines ? `FAQs:\n${faqLines}` : '',
    kb.personality ? `Personality: ${kb.personality}` : '',
    kb.never_say ? `Never say: ${kb.never_say}` : '',
    kb.always_say ? `Always say: ${kb.always_say}` : '',
    kb.escalation ? `Escalate to a human when: ${kb.escalation}` : '',
    channelInstructions,
    'Never say you are an AI unless directly asked.',
  ].filter(Boolean).join('\n')
}

let _anthropic = null
function anthropicClient() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: key })
  return _anthropic
}

export async function callClaude(systemPrompt, userMessage, { maxTokens = 150, temperature = 0.3 } = {}) {
  const client = anthropicClient()
  if (!client) {
    console.warn('[agents:callClaude] ANTHROPIC_API_KEY missing — cannot generate a reply')
    return null
  }
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    return msg.content?.[0]?.text?.trim() || null
  } catch (err) {
    console.error('[agents:callClaude] Error:', err.message)
    return null
  }
}
