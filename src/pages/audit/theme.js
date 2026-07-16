// Nova Audit V2 design tokens — luxury gold/black glass system. Scoped to the audit pages only
// (src/pages/audit/**); the rest of Wave One keeps the original DashboardShell palette in
// src/components, so this file intentionally does not touch tailwind.config.js or index.css.

export const COLORS = {
  bg: '#05070B',
  card: '#0B0F15',
  cardBorder: 'rgba(255,215,100,0.12)',
  gold: '#D4AF37',
  goldLight: '#F4D06F',
  blue: '#1E88E5',
  success: '#00C853',
  warning: '#FFB300',
  danger: '#FF5252',
  white: '#FAFAFA',
  gray: '#9CA3AF',
}

// Score-band color, matching the bands already used in _pdf.js / lib/constants.js scoreMeta —
// this just remaps them onto the V2 palette instead of introducing new thresholds.
export function scoreColor(score) {
  const s = score ?? 0
  if (score == null) return COLORS.gray
  if (s <= 40) return COLORS.danger
  if (s <= 60) return COLORS.warning
  if (s <= 75) return COLORS.goldLight
  if (s <= 85) return COLORS.gold
  return COLORS.success
}

// Glassmorphism panel — gradient + blur + gold hairline border + soft shadow. Used in place of
// the old flat `background: '#0E0E0E', border: '1px solid #2A2A2A'` panels.
export const glassPanel = {
  background: `linear-gradient(155deg, rgba(255,255,255,0.035), rgba(255,255,255,0) 60%), ${COLORS.card}`,
  border: `1px solid ${COLORS.cardBorder}`,
  borderRadius: 16,
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
}

export function glassPanelWithAccent(accentColor = COLORS.gold, opacity = '30') {
  return { ...glassPanel, border: `1px solid ${accentColor}${opacity}` }
}

export const goldDivider = {
  height: 1,
  background: `linear-gradient(90deg, transparent, ${COLORS.gold}80, transparent)`,
}

export const inputStyle = {
  width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.02)',
  border: `1px solid ${COLORS.cardBorder}`, borderRadius: 10, color: COLORS.white, fontSize: 13, outline: 'none',
}

export const labelStyle = {
  display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: COLORS.gray, marginBottom: 7,
}
