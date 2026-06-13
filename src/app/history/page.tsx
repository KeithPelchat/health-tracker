'use client'

import { useCallback, useEffect, useState } from 'react'

interface DailyLog {
  id: number
  date: string
  weight: number | null
  bodyFat: number | null
  bpSys: number | null
  bpDia: number | null
  rhr: number | null
  amSupp: boolean
  pmSupp: boolean
  hydration: number | null
  walkMiles: number | null
  walkMins: number | null
  notes: string | null
}

interface FoodTotal {
  date: string
  protein: number
  netCarbs: number
  calories: number
}

interface BristolEntry {
  id: number
  date: string
  value: number
  timeOfDay: string | null
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  })
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [foodTotals, setFoodTotals] = useState<FoodTotal[]>([])
  const [bristolData, setBristolData] = useState<BristolEntry[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchHistory = useCallback((p: number) => {
    setLoading(true)
    fetch(`/api/history?page=${p}&limit=20`)
      .then(r => r.json())
      .then(data => {
        setLogs(data.logs || [])
        setFoodTotals(data.foodTotals || [])
        setBristolData(data.bristolData || [])
        setTotalPages(data.totalPages || 1)
        setLoading(false)
      })
  }, [])

  useEffect(() => { fetchHistory(page) }, [page, fetchHistory])

  async function handleRefresh() {
    setRefreshing(true)
    await new Promise<void>(resolve => {
      fetch(`/api/history?page=${page}&limit=20`)
        .then(r => r.json())
        .then(data => {
          setLogs(data.logs || [])
          setFoodTotals(data.foodTotals || [])
          setBristolData(data.bristolData || [])
          setTotalPages(data.totalPages || 1)
          setLoading(false)
          resolve()
        })
    })
    setRefreshing(false)
  }

  useEffect(() => {
    const onFocus = () => fetchHistory(page)
    const onVisibility = () => { if (document.visibilityState === 'visible') fetchHistory(page) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [page, fetchHistory])

  return (
    <div className="page">
      <div className="page-hdr">
        <button className={`refresh-btn${refreshing ? ' spinning' : ''}`} onClick={handleRefresh} aria-label="Refresh">↻</button>
        <h1 className="page-title">History</h1>
        <div className="page-sub">Past check-ins</div>
        <div className="page-accent" />
      </div>

      {loading && <div className="loading">Loading…</div>}

      {!loading && logs.length === 0 && (
        <div className="empty">No logs yet. Start logging today!</div>
      )}

      {!loading && logs.map(log => {
        const food = foodTotals.find(f => f.date === log.date)
        const bristols = bristolData.filter(b => b.date === log.date)

        // Bristol chip logic
        let bristolChip = null
        if (bristols.length > 0) {
          const hasGood = bristols.some(b => b.value === 4)
          const hasBad = bristols.some(b => [1, 2, 6, 7].includes(b.value))
          const topValue = bristols[0].value
          const label = `Bristol ${topValue}${bristols.length > 1 ? ` (×${bristols.length})` : ''}`
          bristolChip = (
            <span className={`chip ${hasGood ? 'chip-green' : hasBad ? 'chip-red' : 'chip-gray'}`}>{label}</span>
          )
        }

        return (
          <div key={log.id} className="hist-card">
            <div className="hist-date">{formatDate(log.date)}</div>
            <div className="metrics-row">
              <div className="metric">
                <span className="metric-lbl">Weight</span>
                <span className="metric-val">{log.weight ? `${log.weight} lbs` : '—'}</span>
              </div>
              <div className="metric">
                <span className="metric-lbl">BP</span>
                <span className="metric-val">{log.bpSys && log.bpDia ? `${log.bpSys}/${log.bpDia}` : '—'}</span>
              </div>
              <div className="metric">
                <span className="metric-lbl">RHR</span>
                <span className="metric-val">{log.rhr ? `${log.rhr} bpm` : '—'}</span>
              </div>
            </div>
            <div className="chips">
              {bristolChip}
              {log.hydration != null && (
                <span className={`chip ${log.hydration >= 100 ? 'chip-green' : 'chip-gray'}`}>
                  {log.hydration}oz 💧
                </span>
              )}
              {log.walkMiles != null && (
                <span className="chip chip-blue">{log.walkMiles} mi 🚶</span>
              )}
              {log.amSupp && <span className="chip chip-green">AM ✓</span>}
              {log.pmSupp && <span className="chip chip-green">PM ✓</span>}
              {food && food.protein >= 170 && <span className="chip chip-green">Protein ✓</span>}
              {food && food.protein < 170 && <span className="chip chip-red">Protein ✗</span>}
              {food && food.netCarbs <= 82 && <span className="chip chip-green">Carbs ✓</span>}
              {food && food.netCarbs > 82 && <span className="chip chip-red">Carbs ✗</span>}
            </div>
            {log.notes && (
              <div className="notes-preview">
                {log.notes.length > 120 ? log.notes.slice(0, 120) + '…' : log.notes}
              </div>
            )}
          </div>
        )
      })}

      {!loading && totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span className="page-info">Page {page} of {totalPages}</span>
          <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  )
}
