// This endpoint cannot run as a Vercel Serverless Function — a live call needs a WebSocket
// connection held open for the duration of the call (often several minutes), and Vercel
// functions are request/response only with a hard execution time limit.
//
// The real implementation lives in render-server/server.js, deployed separately to Render.com
// as an always-on Node process. incoming-call.js points Twilio's <Connect><Stream> at that
// service's URL (RENDER_STREAM_URL), not at this file.
export default async function handler(req, res) {
  res.status(501).json({
    error: 'Not implemented on Vercel',
    reason: 'Real-time call audio requires a persistent WebSocket connection. Deploy render-server/ to Render.com and point RENDER_STREAM_URL at it.',
  })
}
