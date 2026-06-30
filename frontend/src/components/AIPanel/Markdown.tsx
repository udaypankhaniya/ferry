import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Play } from 'lucide-react'
import { useSiteStore } from '../../stores/siteStore'
import { runCommand } from '../../lib/aiService'
import { toast } from '../ui'
import { cn } from '../../lib/cn'

// A fenced code block with Copy + Review&run. Run executes via exec mode (clean
// exit capture) — explicit user action, never auto-run.
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const activeSite = useSiteStore((s) => s.activeSite)
  const [running, setRunning] = useState(false)

  async function run() {
    const cmd = code.trim()
    if (!cmd) return
    if (!activeSite) { toast('Connect a host to run commands', 'info'); return }
    setRunning(true)
    try {
      const r = await runCommand(activeSite.id, cmd)
      toast(r.exitCode === 0 ? 'Ran · exit 0' : `Exited ${r.exitCode}`, r.exitCode === 0 ? 'success' : 'danger')
    } catch (e: unknown) {
      toast(String(e), 'danger')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-md border border-border-strong bg-bg-inset">
      <div className="flex items-center gap-1 border-b border-border-hairline px-2 py-1">
        <span className="flex-1 font-mono text-[10px] uppercase tracking-wider text-text-tertiary">{lang || 'code'}</span>
        <button
          onClick={() => { void navigator.clipboard?.writeText(code); toast('Copied', 'neutral') }}
          className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] text-text-tertiary hover:text-text-primary hover:bg-bg-elevated cursor-pointer"
        >
          <Copy size={11} /> Copy
        </button>
        <button
          onClick={run}
          disabled={running}
          className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] text-accent hover:bg-bg-elevated cursor-pointer disabled:opacity-50"
        >
          <Play size={11} /> {running ? 'Running…' : 'Review & run'}
        </button>
      </div>
      <pre className="overflow-x-auto p-2.5 text-[12px] leading-relaxed">
        <code className="font-mono text-text-primary">{code}</code>
      </pre>
    </div>
  )
}

export function Markdown({ content }: { content: string }) {
  return (
    <div
      className={cn(
        'text-[13px] leading-relaxed text-text-primary',
        '[&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5',
        '[&_a]:text-info [&_a]:underline',
        '[&_h1]:text-[15px] [&_h2]:text-[14px] [&_h3]:text-[13px] [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h1]:my-2 [&_h2]:my-2 [&_h3]:my-1.5',
        '[&_strong]:font-semibold [&_em]:italic',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_blockquote]:text-text-secondary',
        // inline code
        '[&_:not(pre)>code]:rounded-sm [&_:not(pre)>code]:bg-bg-elevated [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[12px]'
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Render fenced/multiline code as our CodeBlock; inline code falls
          // through to the styled <code> above.
          code({ className, children, ...props }) {
            const text = String(children ?? '')
            const isBlock = /language-/.test(className || '') || text.includes('\n')
            const lang = /language-(\w+)/.exec(className || '')?.[1]
            if (isBlock) return <CodeBlock code={text.replace(/\n$/, '')} lang={lang} />
            return <code className={className} {...props}>{children}</code>
          },
          pre({ children }) {
            // CodeBlock already provides its own container; avoid a wrapping <pre>.
            return <>{children}</>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
