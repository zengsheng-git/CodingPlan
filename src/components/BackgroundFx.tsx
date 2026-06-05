import { useEffect, useRef } from 'react'

/**
 * Lightweight canvas background: a slow-drifting field of glowing dots
 * and a faint horizontal scan-line. Pure decoration, no interaction.
 */
export default function BackgroundFx() {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const dots = Array.from({ length: 60 }).map(() => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.00015,
      vy: (Math.random() - 0.5) * 0.00015,
      hue: Math.random() < 0.5 ? 175 : 268, // cyan or violet
      alpha: Math.random() * 0.5 + 0.2,
    }))

    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const w = canvas.width
      const h = canvas.height

      for (const d of dots) {
        d.x += d.vx
        d.y += d.vy
        if (d.x < 0) d.x = 1
        if (d.x > 1) d.x = 0
        if (d.y < 0) d.y = 1
        if (d.y > 1) d.y = 0
        ctx.beginPath()
        ctx.arc(d.x * w, d.y * h, d.r * dpr, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${d.hue}, 85%, 70%, ${d.alpha})`
        ctx.shadowColor = `hsla(${d.hue}, 90%, 60%, 0.8)`
        ctx.shadowBlur = 6 * dpr
        ctx.fill()
      }
      ctx.shadowBlur = 0

      // slow horizontal scan line
      const scanY = ((t / 40) % h)
      const grad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30)
      grad.addColorStop(0, 'rgba(94,230,230,0)')
      grad.addColorStop(0.5, 'rgba(94,230,230,0.06)')
      grad.addColorStop(1, 'rgba(94,230,230,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, scanY - 30, w, 60)

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={ref}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-60"
      aria-hidden
    />
  )
}
