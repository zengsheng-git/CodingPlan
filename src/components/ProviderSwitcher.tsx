import { usePlanStore } from '@/store/planStore'
import { cn } from '@/lib/format'
import type { ProviderId } from '@/types/plan'

const OPTIONS: Array<{ id: ProviderId; label: string }> = [
  { id: 'minimax', label: 'MiniMax' },
  { id: 'kimi', label: 'Kimi' },
]

export default function ProviderSwitcher() {
  const provider = usePlanStore(s => s.provider)
  const setProvider = usePlanStore(s => s.setProvider)

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-ink-500/70 bg-ink-800/60 p-1 backdrop-blur">
      {OPTIONS.map(opt => {
        const active = opt.id === provider
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setProvider(opt.id)}
            className={cn(
              'relative h-8 rounded-lg px-4 text-sm font-medium transition-all',
              active
                ? 'bg-gradient-to-r from-cyan/20 to-violet/20 text-cyan shadow-glow'
                : 'text-text-secondary hover:text-text-primary',
            )}
            aria-pressed={active}
          >
            {opt.label}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-transparent via-cyan to-transparent" />
            )}
          </button>
        )
      })}
    </div>
  )
}
