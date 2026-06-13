'use client'

import { useState } from 'react'

type Range = 'today' | 'yesterday' | '7days'

export default function ExportPage() {
  const [range, setRange] = useState<Range>('7days')
  const [output, setOutput] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generate() {
    setLoading(true)
    const res = await fetch(`/api/export?range=${range}`).then(r => r.json())
    setOutput(res.text || '')
    setLoading(false)
  }

  async function copy() {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="page">
      <div className="page-hdr">
        <h1 className="page-title">Export for Claude</h1>
        <div className="page-sub">Copy into any Claude chat to update your health record.</div>
        <div className="page-accent" />
      </div>

      <div className="card">
        <div className="section-label">Date Range</div>
        <div className="toggle-grp">
          {(['today', 'yesterday', '7days'] as Range[]).map(r => (
            <button key={r} className={`tog${range === r ? ' blue' : ''}`} onClick={() => { setRange(r); setOutput(null); }}>
              {r === 'today' ? 'Today' : r === 'yesterday' ? 'Yesterday' : 'Last 7 Days'}
            </button>
          ))}
        </div>
      </div>

      <button className="btn-primary" onClick={generate} disabled={loading}>
        {loading ? 'Generating…' : 'Generate Export'}
      </button>

      {output !== null && (
        <>
          <div className="export-output">{output}</div>
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={copy}>
            {copied ? 'Copied! ✓' : 'Copy to Clipboard'}
          </button>
        </>
      )}
    </div>
  )
}
