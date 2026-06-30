import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { Plus, ArrowUp, Square, Paperclip, X, Terminal as TermIcon, FolderOpen, HardDrive, ShieldCheck, Cloud, ChevronDown, Bot } from 'lucide-react'
import { useAIStore } from '../../stores/aiStore'
import { useSiteStore } from '../../stores/siteStore'
import { hasAPIKey, setAPIKey } from '../../lib/aiService'
import { hasSecrets } from '../../lib/redact'
import { sendChat, stopChat, clearChat, onChatEvents } from '../../lib/chatService'
import { Button, IconButton, Input, Spinner, Menu, MenuTrigger, MenuContent, MenuItem } from '../ui'
import { cn } from '../../lib/cn'
import type { AIProvider } from '../../types'

interface Attachment { label: string; content: string }

const Markdown = lazy(() => import('./Markdown').then((m) => ({ default: m.Markdown })))

const isCloud = (p: AIProvider) => p === 'anthropic' || p === 'openai'

const PROVIDERS: { id: AIProvider; label: string }[] = [
  { id: 'ollama', label: 'Ollama' },
  { id: 'anthropic', label: 'Claude' },
  { id: 'openai', label: 'OpenAI' },
]

export function AIPanel() {
  const {
    provider, cloudThresholdShown, chatId, messages, streaming,
    setProvider, markCloudThresholdShown, addMessage, appendToken, finishMessage, failMessage, setStreaming, newChat,
  } = useAIStore()
  const { activeSite, localPane, remotePane } = useSiteStore()

  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [keyConfigured, setKeyConfigured] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  const assistantIdRef = useRef('')
  const threadRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isCloud(provider)) { setKeyConfigured(true); return }
    setKeyConfigured(false); setKeyDraft('')
    hasAPIKey(provider as 'anthropic' | 'openai').then(setKeyConfigured).catch(() => setKeyConfigured(false))
  }, [provider])

  const cloudReady = !isCloud(provider) || (keyConfigured && cloudThresholdShown)
  // Pre-send trust signal: does the current draft (text + attachment) contain
  // anything the backend redactor will strip? Mirrors the post-send badge.
  const draftSecrets = hasSecrets(attachment ? `${attachment.content}\n${input}` : input)

  useEffect(() => {
    return onChatEvents(chatId, {
      token: (t) => appendToken(assistantIdRef.current, t),
      done: () => finishMessage(assistantIdRef.current),
      error: (msg) => failMessage(assistantIdRef.current, msg),
    })
  }, [chatId, appendToken, finishMessage, failMessage])

  useEffect(() => {
    const onAsk = (e: Event) => {
      const text = (e as CustomEvent<string>).detail
      if (text) setAttachment({ label: 'terminal output', content: text })
    }
    window.addEventListener('ferry:ask-ai', onAsk)
    return () => window.removeEventListener('ferry:ask-ai', onAsk)
  }, [])

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [input])

  async function saveKey() {
    const k = keyDraft.trim()
    if (!k) return
    await setAPIKey(provider as 'anthropic' | 'openai', k).catch(() => {})
    setKeyDraft('')
    setKeyConfigured(await hasAPIKey(provider as 'anthropic' | 'openai').catch(() => false))
  }

  const send = useCallback(() => {
    const text = input.trim()
    if (!text || streaming || !cloudReady) return
    const display = attachment ? `${text}\n\n_(attached: ${attachment.label})_` : text
    const payload = attachment
      ? `[Context — ${attachment.label}]\n${attachment.content}\n\n${text}`
      : text
    addMessage({ id: crypto.randomUUID(), role: 'user', content: display, redacted: hasSecrets(payload) })
    const aid = crypto.randomUUID()
    assistantIdRef.current = aid
    addMessage({ id: aid, role: 'assistant', content: '', streaming: true })
    setStreaming(true)
    setInput('')
    setAttachment(null)
    void sendChat(chatId, provider, activeSite?.id ?? '', payload).catch(() => {})
  }, [input, attachment, streaming, cloudReady, addMessage, setStreaming, chatId, provider, activeSite])

  function attachDir(kind: 'remote' | 'local') {
    if (kind === 'remote') {
      const host = activeSite ? ` on ${activeSite.name || activeSite.host}` : ''
      setAttachment({ label: 'remote dir', content: `Remote working directory: ${remotePane.path}${host}` })
    } else {
      setAttachment({ label: 'local dir', content: `Local working directory: ${localPane.path}` })
    }
  }

  function onComposerKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function stop() {
    void stopChat(chatId)
    finishMessage(assistantIdRef.current)
  }

  function startNewChat() {
    void clearChat(chatId)
    newChat()
  }

  const trustColor = provider === 'ollama' ? 'var(--color-local-safe)' : 'var(--color-cloud-caution)'
  const providerLabel = PROVIDERS.find((p) => p.id === provider)?.label ?? 'Ollama'

  return (
    <div className="flex min-w-0 flex-col bg-bg-surface h-full w-full">
      {/* screen-reader status — announces stream start/end without spamming each token */}
      <div className="sr-only" role="status" aria-live="polite">
        {streaming ? 'Assistant is responding' : messages.length > 0 ? 'Response ready' : ''}
      </div>

      {/* header — provider switcher (dot encodes trust hue) + new chat */}
      <div
        className="flex items-center gap-2 px-2.5 py-2 border-b shrink-0"
        style={{ borderColor: `color-mix(in srgb, ${trustColor} 30%, transparent)` }}
      >
        <Menu>
          <MenuTrigger asChild>
            <button className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 hover:bg-bg-hover cursor-pointer transition-colors">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: trustColor, boxShadow: `0 0 8px color-mix(in srgb, ${trustColor} 50%, transparent)` }}
              />
              <span className="truncate text-[13px] font-semibold tracking-tight text-text-primary">{providerLabel}</span>
              <ChevronDown size={14} className="shrink-0 text-text-tertiary" />
            </button>
          </MenuTrigger>
          <MenuContent align="start">
            {PROVIDERS.map(({ id, label }) => (
              <MenuItem key={id} onSelect={() => setProvider(id)}>
                <span className={cn('h-2 w-2 rounded-full', isCloud(id) ? 'bg-cloud-caution' : 'bg-local-safe')} />
                {label}
                <span className="ml-auto text-[10px] uppercase tracking-wide text-text-tertiary">{isCloud(id) ? 'cloud' : 'local'}</span>
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
        <span className="flex-1" />
        <IconButton label="New chat" size="sm" onClick={startNewChat}><Plus size={14} /></IconButton>
      </div>

      {/* thread */}
      <div ref={threadRef} role="log" aria-label="AI conversation" className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {isCloud(provider) && !keyConfigured && (
          <div
            className="rounded-sm border p-3 flex flex-col gap-2"
            style={{ borderColor: trustColor }}
          >
            <div className="text-[11px] font-semibold" style={{ color: trustColor }}>
              {provider === 'anthropic' ? 'Claude' : 'OpenAI'} — API key required
            </div>
            <div className="text-[11px] text-text-tertiary leading-relaxed">
              Key stored in your OS keychain. Used only for your requests.
            </div>
            <div className="flex gap-1.5">
              <Input
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void saveKey() }}
                placeholder={provider === 'anthropic' ? 'sk-ant-' : 'sk-'}
                className="h-7 flex-1 font-mono text-[12px]"
              />
              <Button size="sm" variant="primary" onClick={saveKey}>Save</Button>
            </div>
          </div>
        )}

        {isCloud(provider) && keyConfigured && !cloudThresholdShown && (
          <div className="rounded-sm border border-cloud-caution bg-cloud-caution-dim p-3 flex flex-col gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-cloud-caution">
              Data leaves your machine
            </div>
            <div className="text-[11px] text-text-secondary leading-relaxed">
              <strong>Sent</strong> to {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}: messages + attached output (secrets redacted).<br />
              <strong>Never sent</strong>: passwords, keys, tokens, env vars.
            </div>
            <Button size="sm" variant="primary" onClick={markCloudThresholdShown} className="self-start">
              I understand — continue
            </Button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center gap-2 text-text-tertiary py-8">
            <div className="text-[13px] font-medium text-text-secondary">Ask anything</div>
            <div className="text-[12px] leading-relaxed max-w-[32ch]">
              {activeSite
                ? `Connected to ${activeSite.name || activeSite.host}. Ask about errors, commands, or transfers.`
                : 'Connect a host for context-aware help.'}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('msg-in flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}
          >
            {msg.role === 'user' ? (
              <div className="flex max-w-[90%] flex-col items-end gap-0.5">
                <div className="rounded-2xl rounded-tr-sm border border-border-strong bg-bg-elevated px-3.5 py-2 text-[13px] text-text-primary whitespace-pre-wrap wrap-break-word">
                  {msg.content}
                </div>
                {msg.redacted && (
                  <span className="flex items-center gap-1 text-[10px] text-local-safe" title="Secrets stripped before sending.">
                    <ShieldCheck size={10} /> secrets redacted
                  </span>
                )}
              </div>
            ) : (
              <div className="w-full">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
                    <Bot size={14} className="text-accent" />
                  </span>
                  <span className="text-[12px] font-medium text-text-secondary">Assistant</span>
                </div>
                <div className={cn('pl-8 text-[13px] leading-relaxed', msg.error && 'text-danger')}>
                  {msg.content ? (
                    <Suspense fallback={<div className="whitespace-pre-wrap wrap-break-word text-text-primary">{msg.content}</div>}>
                      <Markdown content={msg.content} />
                    </Suspense>
                  ) : null}
                  {msg.streaming && (
                    <span className="inline-flex items-center gap-1 text-text-tertiary">
                      {!msg.content && <Spinner size={12} />}
                      <span className="inline-block w-1.5 h-3.5 bg-text-tertiary animate-pulse align-middle" />
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* composer */}
      <div className="border-t border-border-hairline p-2 shrink-0 flex flex-col gap-1.5">
        {attachment && (
          <div className="flex items-center gap-1.5 self-start rounded-sm border border-border-hairline bg-bg-elevated px-2 py-0.5 text-[11px] text-text-secondary">
            {attachment.label === 'terminal output' ? <TermIcon size={11} />
              : attachment.label === 'remote dir' ? <FolderOpen size={11} />
                : <HardDrive size={11} />}
            <span>{attachment.label}</span>
            <button
              onClick={() => setAttachment(null)}
              aria-label="Remove attachment"
              className="text-text-tertiary hover:text-text-primary cursor-pointer"
            >
              <X size={10} />
            </button>
          </div>
        )}

        {draftSecrets && (
          <span
            className="flex items-center gap-1 self-start text-[10px] text-local-safe"
            title="Passwords, keys, and tokens are stripped before this is sent."
          >
            <ShieldCheck size={10} /> secrets will be redacted before send
          </span>
        )}

        <div className="flex items-end gap-1.5 rounded-xl border border-border-strong bg-bg-elevated px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all">
          <Menu>
            <MenuTrigger asChild>
              <button
                aria-label="Attach context"
                className="shrink-0 self-center rounded-sm p-1 text-text-tertiary hover:text-text-primary cursor-pointer"
              >
                <Paperclip size={14} />
              </button>
            </MenuTrigger>
            <MenuContent align="start">
              <MenuItem onSelect={() => attachDir('remote')}><FolderOpen size={13} />Remote directory</MenuItem>
              <MenuItem onSelect={() => attachDir('local')}><HardDrive size={13} />Local directory</MenuItem>
            </MenuContent>
          </Menu>

          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onComposerKey}
            placeholder="Ask, or describe a command"
            className="flex-1 resize-none bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary outline-none leading-relaxed max-h-40"
          />

          {streaming ? (
            <IconButton label="Stop" size="sm" variant="solid" onClick={stop}><Square size={12} /></IconButton>
          ) : (
            <IconButton
              label="Send"
              size="sm"
              variant="primary"
              disabled={!input.trim() || !cloudReady}
              onClick={send}
            >
              <ArrowUp size={14} />
            </IconButton>
          )}
        </div>

        <div className={cn(
          'flex items-center gap-1.5 self-start rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight',
          provider === 'ollama'
            ? 'border-local-safe/20 bg-local-safe/10 text-local-safe'
            : 'border-cloud-caution/20 bg-cloud-caution/10 text-cloud-caution'
        )}>
          {provider === 'ollama' ? (
            <><ShieldCheck size={11} className="shrink-0" /> running locally — nothing leaves your machine</>
          ) : (
            <><Cloud size={11} className="shrink-0" /> sends to cloud · secrets redacted · opt-in</>
          )}
        </div>
      </div>
    </div>
  )
}
