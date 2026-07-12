// Nova Social — Instagram + Facebook DM and comment automation via the Meta Graph API. Requires
// an OAuth-connected Instagram/Facebook Business account and META_ACCESS_TOKEN. See the Setup
// tab in the dashboard (or the comment at the bottom of this file) for webhook configuration.
import { setCors } from '../_cors.js'
import { sanitize } from '../_sanitize.js'
import { supabaseFetch, isSupabaseConfigured } from '../_supabaseAdmin.js'
import { loadAgentByMetaAccount, loadKnowledgeBase, buildSystemPrompt, callClaude } from '../_agents.js'
import { passesContentFilter, reportEngineError, alertHotLeadReply } from '../_automation.js'
import { logEnvCheck } from '../_envCheck.js'

const GRAPH_API = 'https://graph.facebook.com/v18.0'
const DM_INSTRUCTIONS = 'You are responding to a social media direct message. Be friendly, helpful, and conversational. Use casual language. Keep replies under 200 characters. Use one emoji where appropriate.'
const COMMENT_INSTRUCTIONS = 'You are writing a short public reply to a social media comment. Be short, engaging, and professional. Under 50 words. No more than one emoji.'

async function logSocial({ agent_id, platform, event_type, from_user, message, ai_reply, post_id }) {
  if (!isSupabaseConfigured()) return
  try {
    await supabaseFetch('nova_ai_social_logs', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ agent_id: agent_id || null, platform, event_type, from_user, message, ai_reply: ai_reply || null, post_id: post_id || null }),
    })
  } catch (err) {
    console.error('[nova-social:logSocial] Failed:', err.message)
  }
}

async function sendGraphMessage(recipientId, text) {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) throw new Error('META_ACCESS_TOKEN is not configured')
  const r = await fetch(`${GRAPH_API}/me/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.error?.message || `Graph API ${r.status}`)
  return data
}

async function replyToComment(commentId, text) {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) throw new Error('META_ACCESS_TOKEN is not configured')
  const r = await fetch(`${GRAPH_API}/${encodeURIComponent(commentId)}/replies`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.error?.message || `Graph API ${r.status}`)
  return data
}

// ============================================================ ACTION: verify_webhook =======
// GET https://.../api/nova-social?action=verify_webhook&hub.mode=subscribe&hub.verify_token=...&hub.challenge=...

async function handleVerifyWebhook(req, res) {
  const q = req.query || {}
  const mode = q['hub.mode']
  const token = q['hub.verify_token']
  const challenge = q['hub.challenge']
  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    res.setHeader('Content-Type', 'text/plain')
    return res.status(200).send(challenge || '')
  }
  return res.status(403).send('Verification failed')
}

// ============================================================ ACTION: receive_webhook ======
// POST https://.../api/nova-social?action=receive_webhook — handles both Instagram and
// Facebook DM + comment events (object === "instagram" | "page").

async function handleDmEvent({ platform, senderId, messageText, recipientId }) {
  const agent = await loadAgentByMetaAccount(recipientId)
  const kb = agent ? await loadKnowledgeBase(agent.id) : null
  const businessName = kb?.business_name || agent?.business_name || 'Nova Systems'
  const systemPrompt = agent
    ? buildSystemPrompt(agent, kb, DM_INSTRUCTIONS)
    : `You are a virtual assistant for ${businessName}. ${DM_INSTRUCTIONS} Never say you are an AI unless directly asked.`

  const reply = await callClaude(systemPrompt, messageText, { maxTokens: 200, temperature: 0.5 })
  const finalReply = reply || "Thanks for reaching out! Someone from our team will follow up with you shortly. 😊"
  const passed = await passesContentFilter(finalReply, { engine: 'Nova Social', contactLabel: senderId })
  const outbound = passed ? finalReply : "Thanks for reaching out! Someone from our team will follow up with you shortly."

  try {
    await sendGraphMessage(senderId, outbound)
  } catch (err) {
    await reportEngineError('Nova Social', 'send DM reply', senderId, err)
  }

  await logSocial({ agent_id: agent?.id, platform, event_type: 'dm', from_user: senderId, message: messageText, ai_reply: outbound })
  await alertHotLeadReply(platform === 'instagram' ? 'Instagram DM' : 'Facebook Messenger', senderId)
}

async function handleCommentEvent({ platform, commentId, commentText, commenterId, commenterUsername, mediaId, recipientId }) {
  const agent = await loadAgentByMetaAccount(recipientId)
  const kb = agent ? await loadKnowledgeBase(agent.id) : null
  const businessName = kb?.business_name || agent?.business_name || 'Nova Systems'
  const systemPrompt = agent
    ? buildSystemPrompt(agent, kb, COMMENT_INSTRUCTIONS)
    : `You are a virtual assistant for ${businessName}. ${COMMENT_INSTRUCTIONS} Never say you are an AI unless directly asked.`

  const reply = await callClaude(systemPrompt, commentText, { maxTokens: 100, temperature: 0.5 })
  const finalReply = reply || 'Thanks for the comment! We appreciate it. 🙌'
  const passed = await passesContentFilter(finalReply, { engine: 'Nova Social Comment', contactLabel: commenterUsername || commenterId })
  const outboundComment = passed ? finalReply : 'Thanks for the comment! We appreciate it.'

  try {
    await replyToComment(commentId, outboundComment)
  } catch (err) {
    await reportEngineError('Nova Social', 'reply to comment', commenterUsername || commenterId, err)
  }

  // Comment-to-DM trigger — slide into their DMs after replying publicly.
  const dmText = `Hey ${commenterUsername ? commenterUsername : 'there'} I saw your comment and sent you a DM with more info. Go check it out.`
  try {
    if (commenterId) await sendGraphMessage(commenterId, dmText)
  } catch (err) {
    console.error('[nova-social:handleCommentEvent] Follow-up DM failed (non-fatal):', err.message)
  }

  await logSocial({ agent_id: agent?.id, platform, event_type: 'comment', from_user: commenterUsername || commenterId, message: commentText, ai_reply: outboundComment, post_id: mediaId })
}

async function handleReceiveWebhook(req, res) {
  // Meta only supports one callback URL per app — it sends a single GET to verify the
  // subscription (once, at setup time) and POSTs every event after that to the exact same URL.
  // Dispatch on method here instead of forcing a separate action for verification.
  if (req.method === 'GET') return handleVerifyWebhook(req, res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const body = req.body || {}

  // Meta requires a fast 200 response — process asynchronously without awaiting the full
  // fan-out so a slow Claude/Graph API call never causes Meta to retry the same webhook.
  res.status(200).json({ ok: true })

  try {
    const entries = Array.isArray(body.entry) ? body.entry : []
    for (const entry of entries) {
      const recipientId = entry.id

      // Messaging events (DMs) — shared shape for Instagram and Facebook Messenger.
      const messagingEvents = Array.isArray(entry.messaging) ? entry.messaging : []
      for (const evt of messagingEvents) {
        const senderId = evt.sender?.id
        const messageText = sanitize(evt.message?.text, 2000)
        if (!senderId || !messageText) continue
        await handleDmEvent({ platform: body.object === 'instagram' ? 'instagram' : 'facebook', senderId, messageText, recipientId })
      }

      // Changes events (comments) — Instagram and Facebook both deliver comment events here.
      const changes = Array.isArray(entry.changes) ? entry.changes : []
      for (const change of changes) {
        if (change.field !== 'comments' && change.field !== 'feed') continue
        const value = change.value || {}
        const commentId = value.comment_id || value.id
        const commentText = sanitize(value.text || value.message, 2000)
        const commenterId = value.from?.id
        const commenterUsername = value.from?.username || value.from?.name
        const mediaId = value.media?.id || value.post_id
        if (!commentId || !commentText) continue
        await handleCommentEvent({ platform: body.object === 'instagram' ? 'instagram' : 'facebook', commentId, commentText, commenterId, commenterUsername, mediaId, recipientId })
      }
    }
  } catch (err) {
    console.error('[nova-social:receive_webhook] Processing error (response already sent to Meta):', err.message)
  }
}

// ============================================================ ACTION: setup_status =========

async function handleSetupStatus(req, res) {
  return res.status(200).json({
    metaAccessTokenConfigured: !!process.env.META_ACCESS_TOKEN,
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || null,
  })
}

// ============================================================ ACTION: get_social_logs ======

async function handleGetSocialLogs(req, res) {
  if (!isSupabaseConfigured()) return res.status(200).json([])
  const q = req.query || {}
  const page = Math.max(1, parseInt(q.page, 10) || 1)
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 100))
  const offset = (page - 1) * limit
  const filters = []
  if (q.platform) filters.push(`platform=eq.${encodeURIComponent(q.platform)}`)
  if (q.event_type) filters.push(`event_type=eq.${encodeURIComponent(q.event_type)}`)
  const query = filters.length ? `&${filters.join('&')}` : ''
  const r = await supabaseFetch(`nova_ai_social_logs?order=created_at.desc&limit=${limit}&offset=${offset}${query}`)
  return res.status(200).json(r.ok ? await r.json() : [])
}

// ================================================================================= router ==

export default async function handler(req, res) {
  try {
    if (setCors(req, res)) return
    logEnvCheck('Nova Social', ['META_ACCESS_TOKEN', 'META_WEBHOOK_VERIFY_TOKEN', 'ANTHROPIC_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
    const action = typeof req.query?.action === 'string' ? req.query.action : ''

    switch (action) {
      case 'verify_webhook':          return await handleVerifyWebhook(req, res)
      case 'receive_webhook':         return await handleReceiveWebhook(req, res)
      // Meta's webhook subscription for a given field arrives as a GET (verification) once, then
      // POSTs (events) after — but some setups point Instagram and Facebook at separate URLs, so
      // these aliases are accepted too.
      case 'receive_instagram_webhook': return await handleReceiveWebhook(req, res)
      case 'receive_facebook_webhook':  return await handleReceiveWebhook(req, res)
      case 'get_social_logs':         return await handleGetSocialLogs(req, res)
      case 'setup_status':            return await handleSetupStatus(req, res)
      default:
        if (req.method === 'GET' && !action) return await handleGetSocialLogs(req, res)
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('[Nova Social] Unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}

// Meta webhook configuration (Meta for Developers -> your app -> Webhooks):
//   Callback URL:   https://nova-wave-one.vercel.app/api/nova-social?action=receive_webhook
//   Verify token:   value of META_WEBHOOK_VERIFY_TOKEN
//   Subscriptions:  messages, messaging_postbacks, comments (Instagram + Page)
// Meta sends one GET to this same URL at setup time to verify the subscription (handled by the
// GET branch inside handleReceiveWebhook above), then POSTs every event to it after that.
