'use client'

import { useEffect, useState, useRef } from 'react'

interface HistoryRec {
  id: number
  date: string
  content: string
  generatedAt: string
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtDateLong(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  })
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
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

    // Watch List section header
    if (line.startsWith('**Watch List') || line.startsWith('**⚠️')) {
      const content = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^#+\s*/, '')
      elements.push(
        <div key={key++} className="rec-section-warn">
          <div className="rec-section-hdr warn">{content}</div>
        </div>
      )
      continue
    }

    // What's Working section header
    if (line.startsWith("**What's Working") || line.startsWith('**✅')) {
      const content = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^#+\s*/, '')
      elements.push(
        <div key={key++} className="rec-section-win">
          <div className="rec-section-hdr win">{content}</div>
        </div>
      )
      continue
    }

    // Other bold section headers (Food Plan, Movement, Hydration, Sleep)
    if (line.match(/^\*\*[A-Z]/)) {
      const content = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^#+\s*/, '')
      elements.push(<div key={key++} className="rec-section-hdr">{content}</div>)
      continue
    }

    // Bullet points
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

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const content = line.replace(/^\d+\.\s/, '')
      elements.push(
        <div key={key++} className="rec-para" dangerouslySetInnerHTML={{ __html: boldify(content) }} />
      )
      continue
    }

    // Regular paragraph
    elements.push(
      <div key={key++} className="rec-para" dangerouslySetInnerHTML={{ __html: boldify(line) }} />
    )
  }

  return elements
}

export default function RecommendationsPage() {
  const today = getTodayStr()
  const [content, setContent] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'streaming' | 'done' | 'error'>('loading')
  const [streamText, setStreamText] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const [showContext, setShowContext] = useState(false)
  const [contextText, setContextText] = useState('')
  const [savingContext, setSavingContext] = useState(false)
  const [contextDirty, setContextDirty] = useState(false)

  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<HistoryRec[]>([])
  const [expandedHistId, setExpandedHistId] = useState<number | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  async function loadToday() {
    setStatus('loading')
    try {
      const res = await fetch('/api/recommendations/today')
      const data = await res.json()
      if (data.content) {
        setContent(data.content)
        setGeneratedAt(data.generatedAt)
        setStatus('done')
      } else {
        setContent(null)
        setStatus('idle')
      }
    } catch {
      setStatus('error')
    }
  }

  async function generate() {
    if (refreshing) return
    setRefreshing(true)
    setStreamText('')
    setContent(null)
    setGeneratedAt(null)
    setStatus('streaming')

    abortRef.current = new AbortController()
    try {
      const res = await fetch('/api/recommendations/generate', {
        method: 'POST',
        signal: abortRef.current.signal,
      })
      if (!res.ok || !res.body) throw new Error('Failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setStreamText(full)
      }

      setContent(full)
      setGeneratedAt(new Date().toISOString())
      setStatus('done')
      loadToday()
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setStatus('error')
      }
    } finally {
      setRefreshing(false)
    }
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

  useEffect(() => { loadToday() }, [])

  const displayText = status === 'streaming' ? streamText : (content ?? '')
  const hasContent = displayText.length > 0

  // Split first paragraph from rest for special styling
  const firstNewline = displayText.indexOf('\n\n')
  const firstPara = firstNewline > 0 ? displayText.slice(0, firstNewline) : displayText
  const rest = firstNewline > 0 ? displayText.slice(firstNewline + 2) : ''

  return (
    <div className="page">
      <div className="page-hdr">
        <button
          className={`refresh-btn${refreshing ? ' spinning' : ''}`}
          onClick={() => generate()}
          disabled={refreshing}
          aria-label="Generate new recommendation"
        >&#8635;</button>
        <h1 className="page-title">Daily Coach</h1>
        <div className="page-sub" style={{ color: 'var(--sky)' }}>{fmtDateLong(today)}</div>
        <div className="page-accent" />
      </div>

      {/* Status bar */}
      <div className="rec-status">
        {status === 'done' && generatedAt && (
          <span className="rec-status-ok">Generated today at {fmtTime(generatedAt)}</span>
        )}
        {status === 'streaming' && (
          <span className="rec-status-generating">
            Generating your coaching plan
            <span className="rec-dots"><span>.</span><span>.</span><span>.</span></span>
          </span>
        )}
        {status === 'error' && (
          <span className="rec-status-err">Generation failed — tap refresh to retry</span>
        )}
        {status === 'idle' && (
          <span className="rec-status-idle">No recommendation yet today — tap refresh to generate</span>
        )}
        {status === 'loading' && (
          <span className="rec-status-idle">Loading…</span>
        )}
      </div>

      {/* Main recommendation card */}
      <div className="rec-card">
        {!hasContent && status === 'loading' && (
          <div className="rec-skeleton">
            <div className="rec-skel-bar" style={{ width: '90%' }} />
            <div className="rec-skel-bar" style={{ width: '75%' }} />
            <div className="rec-skel-bar" style={{ width: '85%' }} />
          </div>
        )}

        {!hasContent && status === 'idle' && (
          <div className="rec-empty">
            <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
            <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>No recommendation yet</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 15 }}>Tap refresh above to generate your daily coaching plan.</div>
          </div>
        )}

        {hasContent && (
          <>
            <div className="rec-coach-para">
              {renderMarkdown(firstPara)}
            </div>
            {rest && (
              <div className="rec-sections">
                {renderMarkdown(rest)}
              </div>
            )}
          </>
        )}
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
            <div className="rec-context-note">Changes take effect on next generation</div>
          </div>
        )}
      </div>

      {/* History */}
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
