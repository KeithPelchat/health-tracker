'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { toChicagoDateStr, formatChicagoDisplay } from '@/lib/dates'

interface ChatMessage {
  id: string | number
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string // ephemeral, client-only, never persisted
}

interface HistoryRec {
  id: number
  date: string
  content: string
  generatedAt: string
}

const SUGGESTED_PROMPTS = [
  "What's left on my targets today?",
  "Give me my daily coaching briefing.",
  "I'm making chicken for dinner — how much should I eat?",
  "I skipped my walk — how do I adjust food?",
  "What should my last meal of the day look like?",
  "How is my week looking overall?",
]

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  })
}

function boldify(text: string) {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}

function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.trim() === '') {
      elements.push(<div key={key++} style={{ height: 8 }} />)
      continue
    }

    if (line.startsWith('**Watch List') || line.startsWith('**⚠️')) {
      const content = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^#+\s*/, '')
      elements.push(
        <div key={key++} className="rec-section-warn">
          <div className="rec-section-hdr warn">{content}</div>
        </div>
      )
      continue
    }

    if (line.startsWith("**What's Working") || line.startsWith('**✅')) {
      const content = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^#+\s*/, '')
      elements.push(
        <div key={key++} className="rec-section-win">
          <div className="rec-section-hdr win">{content}</div>
        </div>
      )
      continue
    }

    if (line.match(/^\*\*[A-Z]/)) {
      const content = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^#+\s*/, '')
      elements.push(<div key={key++} className="rec-section-hdr">{content}</div>)
      continue
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.slice(2)
      elements.push(
        <div key={key++} className="rec-bullet">
          <span className="rec-bullet-dot">•</span>
          <span dangerouslySetInnerHTML={{ __html: boldify(content) }} />
        </div>
      )
      continue
    }

    if (/^\d+\.\s/.test(line)) {
      const content = line.replace(/^\d+\.\s/, '')
      elements.push(
        <div key={key++} className="rec-para" dangerouslySetInnerHTML={{ __html: boldify(content) }} />
      )
      continue
    }

    elements.push(
      <div key={key++} className="rec-para" dangerouslySetInnerHTML={{ __html: boldify(line) }} />
    )
  }

  return elements
}

export default function CoachPage() {
  const todayStr = toChicagoDateStr()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')

  const [attachedImage, setAttachedImage] = useState<{
    file: File
    previewUrl: string
    mimeType: string
  } | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  const [showContext, setShowContext] = useState(false)
  const [contextText, setContextText] = useState('')
  const [savingContext, setSavingContext] = useState(false)
  const [contextDirty, setContextDirty] = useState(false)

  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<HistoryRec[]>([])
  const [expandedHistId, setExpandedHistId] = useState<number | null>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setLoadingMessages(true)
    fetch(`/api/coach/messages?date=${todayStr}`)
      .then(r => r.json())
      .then(data => {
        setMessages(data.messages || [])
        setLoadingMessages(false)
      })
      .catch(() => setLoadingMessages(false))
  }, [todayStr])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (isStreaming || (!trimmed && !attachedImage)) return

    const imageToSend = attachedImage

    // Save user message to DB (text only — images are ephemeral)
    const savedUser = await fetch('/api/coach/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: todayStr, role: 'user', content: trimmed }),
    }).then(r => r.json())

    const userMsg: ChatMessage = {
      ...(savedUser.message ?? { id: `u-${Date.now()}`, role: 'user', content: trimmed }),
      imageUrl: imageToSend?.previewUrl,
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setAttachedImage(null)
    setImageError(null)
    setIsStreaming(true)
    setStreamingContent('')

    abortRef.current = new AbortController()

    try {
      let res: Response

      if (imageToSend) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.onerror = () => reject(new Error('Failed to read image file'))
          reader.readAsDataURL(imageToSend.file)
        })

        res = await fetch('/api/coach/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Send prior messages (without the current user turn — server appends image turn)
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            message: trimmed,
            imageBase64: base64,
            mimeType: imageToSend.mimeType || 'image/jpeg',
          }),
          signal: abortRef.current.signal,
        })
      } else {
        res = await fetch('/api/coach/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          }),
          signal: abortRef.current.signal,
        })
      }

      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setStreamingContent(full)
      }

      // Save assistant message to DB
      const savedAssistant = await fetch('/api/coach/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayStr, role: 'assistant', content: full }),
      }).then(r => r.json())

      const assistantMsg: ChatMessage = savedAssistant.message ?? { id: `a-${Date.now()}`, role: 'assistant', content: full }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: 'Sorry, something went wrong. Try again.' }])
      }
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
    }
  }, [isStreaming, messages, todayStr, attachedImage])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image too large (max 5MB)')
      e.target.value = ''
      return
    }
    setImageError(null)
    setAttachedImage({ file, previewUrl: URL.createObjectURL(file), mimeType: file.type })
    e.target.value = ''
  }

  function removeImage() {
    if (attachedImage) URL.revokeObjectURL(attachedImage.previewUrl)
    setAttachedImage(null)
    setImageError(null)
  }

  function clearChat() {
    setMessages([])
  }

  async function loadContext() {
    const res = await fetch('/api/recommendations/context')
    const data = await res.json()
    setContextText(data.content)
    setContextDirty(false)
  }

  async function saveContext() {
    setSavingContext(true)
    await fetch('/api/recommendations/context', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: contextText }),
    })
    setSavingContext(false)
    setContextDirty(false)
  }

  async function loadHistory() {
    const res = await fetch('/api/recommendations/history')
    const data = await res.json()
    setHistory(data.recommendations || [])
  }

  const hasMessages = messages.length > 0 || isStreaming || loadingMessages

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      {/* HEADER */}
      <div className="page-hdr">
        <h1 className="page-title">Daily Coach</h1>
        <div className="page-sub">{formatChicagoDisplay(todayStr)}</div>
        <div className="page-accent" />
      </div>

      {/* CHAT AREA */}
      <div style={{
        background: 'var(--surface)',
        border: '2px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '16px',
        marginBottom: 12,
        minHeight: 240,
        maxHeight: '55vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {loadingMessages ? (
          <div className="rec-skeleton">
            <div className="rec-skel-bar" style={{ width: '60%', alignSelf: 'flex-end' }} />
            <div className="rec-skel-bar" style={{ width: '80%' }} />
          </div>
        ) : !hasMessages ? (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Suggested questions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SUGGESTED_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  style={{
                    background: 'var(--surface2)',
                    border: '2px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    textAlign: 'left',
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--navy)',
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'var(--navy)'; (e.target as HTMLElement).style.background = 'var(--sky-light)' }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; (e.target as HTMLElement).style.background = 'var(--surface2)' }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} style={msg.role === 'user' ? {
                alignSelf: 'flex-end',
                background: 'var(--navy)',
                color: '#fff',
                borderRadius: '14px 14px 4px 14px',
                padding: '12px 16px',
                maxWidth: '85%',
                fontSize: 15,
                fontWeight: 500,
                lineHeight: 1.5,
              } : {
                alignSelf: 'flex-start',
                background: 'var(--surface2)',
                borderLeft: '3px solid var(--sky)',
                borderRadius: '4px 14px 14px 14px',
                padding: '12px 16px',
                maxWidth: '95%',
                fontSize: 15,
                lineHeight: 1.6,
              }}>
                {msg.role === 'user' && msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt=""
                    style={{
                      maxWidth: 200,
                      borderRadius: 12,
                      display: 'block',
                      marginBottom: msg.content ? 8 : 0,
                    }}
                  />
                )}
                {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
              </div>
            ))}
            {isStreaming && streamingContent && (
              <div style={{
                alignSelf: 'flex-start',
                background: 'var(--surface2)',
                borderLeft: '3px solid var(--sky)',
                borderRadius: '4px 14px 14px 14px',
                padding: '12px 16px',
                maxWidth: '95%',
                fontSize: 15,
                lineHeight: 1.6,
              }}>
                {renderMarkdown(streamingContent)}
                <span className="rec-dots"><span>.</span><span>.</span><span>.</span></span>
              </div>
            )}
            {isStreaming && !streamingContent && (
              <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, padding: '8px 0' }}>
                Thinking
                <span className="rec-dots"><span>.</span><span>.</span><span>.</span></span>
              </div>
            )}
          </>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* CLEAR BUTTON (shown when there are messages) */}
      {hasMessages && (
        <div style={{ textAlign: 'right', marginBottom: 8 }}>
          <button onClick={clearChat} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Clear chat
          </button>
        </div>
      )}

      {/* INPUT AREA */}
      <div style={{ marginBottom: 16 }}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"

          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {/* Thumbnail preview */}
        {attachedImage && (
          <div style={{ marginBottom: 8, position: 'relative', display: 'inline-block' }}>
            <img
              src={attachedImage.previewUrl}
              alt=""
              style={{
                width: 80,
                height: 80,
                objectFit: 'cover',
                borderRadius: 8,
                border: '1.5px solid var(--border)',
                display: 'block',
              }}
            />
            <button
              onClick={removeImage}
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'var(--navy)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Error message */}
        {imageError && (
          <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600, marginBottom: 6 }}>
            {imageError}
          </div>
        )}

        {/* Input row */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          {/* Camera button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            title="Attach image"
            style={{
              background: 'var(--surface2)',
              color: 'var(--sky)',
              border: '2px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px 14px',
              fontSize: 18,
              cursor: isStreaming ? 'not-allowed' : 'pointer',
              opacity: isStreaming ? 0.5 : 1,
              flexShrink: 0,
              minHeight: 56,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            📷
          </button>

          <textarea
            ref={textareaRef}
            className="input"
            placeholder="Ask your coach…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            style={{ flex: 1, minHeight: 56, resize: 'none', fontSize: 16, padding: '14px 16px' }}
            disabled={isStreaming}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isStreaming || (!input.trim() && !attachedImage)}
            style={{
              background: 'var(--navy)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '14px 20px',
              fontSize: 16,
              fontWeight: 800,
              cursor: isStreaming || (!input.trim() && !attachedImage) ? 'not-allowed' : 'pointer',
              opacity: isStreaming || (!input.trim() && !attachedImage) ? 0.5 : 1,
              fontFamily: 'Inter, sans-serif',
              flexShrink: 0,
              minHeight: 56,
            }}
          >
            {isStreaming ? '…' : 'Send'}
          </button>
        </div>
      </div>

      {/* Protocol Context Editor */}
      <div className="rec-collapsible">
        <button
          className="rec-collapse-btn"
          onClick={() => {
            setShowContext(s => !s)
            if (!showContext && !contextText) loadContext()
          }}
        >
          <span>Edit Protocol Context</span>
          <span className="rec-chevron">{showContext ? '▲' : '▼'}</span>
        </button>
        {showContext && (
          <div className="rec-context-editor">
            <textarea
              className="rec-context-textarea"
              value={contextText}
              onChange={e => { setContextText(e.target.value); setContextDirty(true) }}
              rows={20}
            />
            <div className="rec-context-actions">
              <button
                className="btn-primary"
                onClick={saveContext}
                disabled={savingContext || !contextDirty}
              >
                {savingContext ? 'Saving…' : 'Save Context'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => { setShowContext(false); setContextDirty(false) }}
              >
                Cancel
              </button>
            </div>
            <div className="rec-context-note">Changes take effect on next message</div>
          </div>
        )}
      </div>

      {/* Past Recommendations */}
      <div className="rec-collapsible">
        <button
          className="rec-collapse-btn"
          onClick={() => {
            setShowHistory(s => !s)
            if (!showHistory && history.length === 0) loadHistory()
          }}
        >
          <span>Past Recommendations</span>
          <span className="rec-chevron">{showHistory ? '▲' : '▼'}</span>
        </button>
        {showHistory && (
          <div className="rec-history">
            {history.length === 0 && (
              <div className="rec-empty" style={{ padding: '16px 0' }}>No past recommendations yet.</div>
            )}
            {history.map(rec => (
              <div key={rec.id} className="rec-hist-item">
                <button
                  className="rec-hist-date"
                  onClick={() => setExpandedHistId(expandedHistId === rec.id ? null : rec.id)}
                >
                  <span>{fmtDateShort(rec.date)} — {fmtTime(rec.generatedAt)}</span>
                  <span className="rec-chevron">{expandedHistId === rec.id ? '▲' : '▼'}</span>
                </button>
                {expandedHistId !== rec.id && (
                  <div className="rec-hist-preview">{rec.content.slice(0, 100)}…</div>
                )}
                {expandedHistId === rec.id && (
                  <div className="rec-hist-content">
                    {renderMarkdown(rec.content)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
