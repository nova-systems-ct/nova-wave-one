// Logs which of the given environment variables are present/missing at the start of every
// request, without ever logging a value — so when something fails in the Vercel function logs
// it's immediately visible whether it's a missing-config problem or something else, instead of
// having to guess or reproduce it locally.
export function logEnvCheck(engineName, varNames) {
  const present = varNames.filter((name) => !!process.env[name])
  const missing = varNames.filter((name) => !process.env[name])
  console.log(`[${engineName}] Env check — present: [${present.join(', ') || 'none'}]`)
  if (missing.length) console.warn(`[${engineName}] Env check — missing: [${missing.join(', ')}]`)
}
