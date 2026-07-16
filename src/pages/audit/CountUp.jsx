import { useEffect, useRef, useState } from 'react'

// Animates a numeric value counting up from 0 once, on mount — used for the executive score
// and dollar figures so they read as "live" without misrepresenting the underlying number.
export default function CountUp({ value, duration = 900, format = (n) => String(n), className, style }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef(null)

  useEffect(() => {
    const target = Number(value) || 0
    const start = performance.now()
    const from = 0
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (target - from) * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => raf.current && cancelAnimationFrame(raf.current)
  }, [value, duration])

  return <span className={className} style={style}>{format(display)}</span>
}
