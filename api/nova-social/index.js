import { setCors } from '../_cors.js'

// Social platform DM/comment automation requires each platform's OAuth-based Business API
// (Meta Graph API for Instagram/Facebook, TikTok Business API, LinkedIn Marketing API) —
// each needs its own app review and a connected business account before any of this can run.
// This endpoint is scaffolded and ready to wire in once those accounts are connected.
export default async function handler(req, res) {
  if (setCors(req, res)) return
  const action = typeof req.query?.action === 'string' ? req.query.action : ''

  if (action === 'get_messages') return res.status(200).json([])

  return res.status(501).json({
    error: 'Not connected',
    reason: 'Nova Social requires OAuth-connected Instagram/Facebook/TikTok/LinkedIn business accounts before it can send or receive messages.',
  })
}
