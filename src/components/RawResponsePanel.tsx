import { useState } from 'react'
import { ChevronDown, ChevronUp, Code2, Copy, Check } from 'lucide-react'
import { usePlanStore } from '@/store/planStore'
import { formatTimestamp } from '@/lib/format'

const TOKEN_RE = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g

function highlight(json: string) {
  return json.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string).replace(TOKEN_RE, match => {
    let cls = 'raw-json-number'
    if (/^"/.test(match)) {
      cls = /:$/.test(match) ? 'raw-json-key' : 'raw-json-string'
    } else if (/true|false/.test(match)) {
      cls = 'raw-json-bool'
    } else if (/null/.test(match)) {
      cls = 'raw-json-null'
    }
    return `<span class="${cls}">${match}</span>`
  })
}

export default function RawResponsePanel() {
  const data = usePlanStore(s => s.data)
  const showRaw = usePlanStore(s => s.showRaw)
  const setShowRaw = usePlanStore(s => s.setShowRaw)
  const [copied, setCopied] = useState(false)

  if (!data) return null

  const text = JSON.stringify(data, null, 2)
  const html = highlight(text)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // ignore
    }
  }

  return (
    <section className="glass-panel reveal-6 animate-fade-in-up mt-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setShowRaw(!showRaw)}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left transition-colors hover:bg-ink-800/40"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet/20 to-cyan/20 text-violet-soft ring-1 ring-violet/30">
            <Code2 size={14} />
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-text-primary">Raw Response</p>
            <p className="text-[11px] text-text-muted">
              {data.sources.length} 个端点 · {data.ok ? '至少一个成功' : '全部失败'} · 后端原始 JSON
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[11px] text-text-muted md:inline">
            {formatTimestamp(data.sources[0]?.fetchedAt)}
          </span>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              void handleCopy()
            }}
            className="flex h-7 items-center gap-1 rounded-md border border-ink-500 px-2 text-[11px] text-text-secondary transition-colors hover:border-cyan/40 hover:text-cyan"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? '已复制' : '复制'}
          </button>
          {showRaw ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
        </div>
      </button>
      {showRaw && (
        <div className="border-t border-ink-500/60 bg-ink-950/60">
          <pre
            className="max-h-[420px] overflow-auto px-5 py-4 font-mono text-[12px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </section>
  )
}
