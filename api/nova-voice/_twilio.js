import crypto from 'crypto'

export function validateTwilioSignature(req, authToken, fullUrl) {
  if (!authToken) return false
  const signature = req.headers['x-twilio-signature']
  if (!signature) return false
  const params = req.body && typeof req.body === 'object' ? req.body : {}
  const sortedKeys = Object.keys(params).sort()
  let data = fullUrl
  for (const key of sortedKeys) data += key + params[key]
  const expected = crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export function escapeXml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export function twiml(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`
}
