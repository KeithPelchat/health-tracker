'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ReferenceArea, Cell,
  ComposedChart,
} from 'recharts'

interface SleepTrendPoint {
  date: string
  sleepScore: number | null
  sleepQuality: string | null
  sleepHours: number | null
}

interface SleepStats {
  avgScore: number | null
  highPct: number
  okPct: number
  poorPct: number
  highCount: number
  okCount: number
  poorCount: number
}

interface SleepWeightCorr {
  afterHighAvgWeight: number | null
  afterOkPoorAvgWeight: number | null
}

interface PatternsData {
  weightTrend: { date: string; weight: number }[]
  bpTrend: { date: string; bpSys: number; bpDia: number }[]
  bristolFreq: { type: number; count: number }[]
  macroHitRate: { proteinPct: number; carbsPct: number; daysWithFood: number }
  dailyCalories: { date: string; calories: number; burnKcal: number | null }[]
  hydrationTrend: { date: string; hydration: number }[]
  hydrationAvg: number
  hydrationTargetPct: number
  walkTrend: { date: string; walkMiles: number }[]
  walkTotal: number
  walkCount: number
  walkAvg: number
  walkHRTrend: { date: string; walkAvgHR: number }[]
  walkHRAvg: number | null
  avgWeight: number | null
  totalDays: number
  walkBurn: { date: string; burnKcal: number }[]
  tdeeBaseline: number
  sleepTrend: SleepTrendPoint[]
  sleepStats: SleepStats
  sleepWeightCorr: SleepWeightCorr
}

const TOOLTIP_STYLE = {
  contentStyle: { background: '#ffffff', border: '1px solid #c8d6e8', borderRadius: 8, fontSize: 13 },
}

const AXIS_STYLE = { stroke: '#c8d6e8', tick: { fill: '#4a6080', fontSize: 11 } }

function pctColor(pct: number) {
  if (pct >= 80) return 'var(--green)'
  if (pct >= 60) return 'var(--yellow)'
  return 'var(--red)'
}

function fmtDate(d: string) {
  const [, m, day] = d.split('-')
  return `${m}/${day}`
}

// Custom dot with color based on sleep score
function SleepDot(props: { cx?: number; cy?: number; payload?: { sleepScore: number } }) {
  const { cx, cy, payload } = props
  const score = payload?.sleepScore ?? 0
  const fill = score >= 80 ? '#1a7a4a' : score >= 60 ? '#a07800' : '#b02020'
  return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="white" strokeWidth={1.5} />
}

export default function PatternsPage() {
  const [period, setPeriod] = useState<'7' | '30' | 'all'>('7')
  const [data, setData] = useState<PatternsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/patterns?period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [period])

  return (
    <div className="page">
      <div className="page-hdr">
        <h1 className="page-title">Patterns</h1>
        <div className="page-sub">Trends over time</div>
        <div className="page-accent" />
      </div>

      <div className="period-tabs">
        {(['7', '30', 'all'] as const).map(p => (
          <button key={p} className={`period-tab${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>
            {p === '7' ? '7 Days' : p === '30' ? '30 Days' : 'All Time'}
          </button>
        ))}
      </div>

      {loading && <div className="loading">Loading…</div>}

      {!loading && data && (
        <>
          {/* Weight & BP Trend */}
          <div className="chart-card">
            <div className="chart-title">Weight & Blood Pressure</div>
            <div className="chart-sub">Daily readings over period</div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={(() => {
                  const byDate: Record<string, { date: string; weight?: number; bpSys?: number; bpDia?: number }> = {}
                  data.weightTrend.forEach(w => { byDate[w.date] = { ...byDate[w.date], date: w.date, weight: w.weight } })
                  data.bpTrend.forEach(b => { byDate[b.date] = { ...byDate[b.date], date: b.date, bpSys: b.bpSys, bpDia: b.bpDia } })
                  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
                })()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#c8d6e8" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend />
                  <Line type="monotone" dataKey="weight" stroke="#2980b9" dot={false} connectNulls />
                  <Line type="monotone" dataKey="bpSys" stroke="var(--red)" dot={false} connectNulls />
                  <Line type="monotone" dataKey="bpDia" stroke="var(--yellow)" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sleep Score Trend */}
          {data.sleepTrend.filter(s => s.sleepScore !== null).length > 0 && (
            <div className="chart-card">
              <div className="chart-title">Sleep Score Trend</div>
              <div className="chart-sub">Daily sleep scores</div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.sleepTrend.filter(s => s.sleepScore !== null)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#c8d6e8" />
                    <XAxis dataKey="date" tickFormatter={fmtDate} {...AXIS_STYLE} />
                    <YAxis domain={[0, 100]} {...AXIS_STYLE} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <ReferenceLine y={80} stroke="#1a7a4a" strokeDasharray="4 4" label={{ value: '80', fill: '#1a7a4a', fontSize: 10 }} />
                    <ReferenceLine y={60} stroke="#a07800" strokeDasharray="4 4" label={{ value: '60', fill: '#a07800', fontSize: 10 }} />
                    <Line type="monotone" dataKey="sleepScore" stroke="#6c3483" dot={<SleepDot />} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {data.sleepStats.avgScore !== null && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                  Avg sleep score: {data.sleepStats.avgScore} — High {data.sleepStats.highPct}% / OK {data.sleepStats.okPct}% / Poor {data.sleepStats.poorPct}%
                </div>
              )}

              {/* Sleep quality stat boxes */}
              {(data.sleepStats.highCount + data.sleepStats.okCount + data.sleepStats.poorCount) > 0 && (
                <div className="stat-boxes" style={{ marginTop: 16 }}>
                  <div className="stat-box">
                    <div className="stat-pct" style={{ color: 'var(--green)' }}>{data.sleepStats.highCount}</div>
                    <div className="stat-lbl">High nights</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-pct" style={{ color: 'var(--gold)' }}>{data.sleepStats.okCount}</div>
                    <div className="stat-lbl">OK nights</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-pct" style={{ color: 'var(--red)' }}>{data.sleepStats.poorCount}</div>
                    <div className="stat-lbl">Poor nights</div>
                  </div>
                </div>
              )}

              {/* Sleep vs weight insight */}
              {data.sleepWeightCorr.afterHighAvgWeight !== null && (
                <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)', background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px' }}>
                  <div>After High sleep: avg next-day weight <strong>{data.sleepWeightCorr.afterHighAvgWeight} lbs</strong></div>
                  {data.sleepWeightCorr.afterOkPoorAvgWeight !== null && (
                    <div>After OK/Poor sleep: avg next-day weight <strong>{data.sleepWeightCorr.afterOkPoorAvgWeight} lbs</strong></div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Bristol Frequency */}
          <div className="chart-card">
            <div className="chart-title">Bristol Frequency</div>
            <div className="chart-sub">Distribution of stool types</div>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.bristolFreq}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#c8d6e8" />
                  <XAxis dataKey="type" {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.bristolFreq.map(entry => (
                      <Cell key={entry.type} fill={
                        entry.type === 4 ? '#1a7a4a' :
                        [1, 2, 6, 7].includes(entry.type) ? '#b02020' :
                        '#2980b9'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
              {data.bristolFreq.reduce((s, b) => s + b.count, 0)} total entries across {data.totalDays} days
            </div>
          </div>

          {/* Macro Hit Rate */}
          <div className="chart-card">
            <div className="chart-title">Macro Hit Rate</div>
            <div className="chart-sub">Based on {data.macroHitRate.daysWithFood} days with food logged</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: pctColor(data.macroHitRate.proteinPct) }}>
                  {data.macroHitRate.proteinPct}%
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>of days protein ≥170g</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: pctColor(data.macroHitRate.carbsPct) }}>
                  {data.macroHitRate.carbsPct}%
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>of days carbs ≤82g</div>
              </div>
            </div>
          </div>

          {/* Daily Calories with Walk Burn */}
          <div className="chart-card">
            <div className="chart-title">Daily Calories</div>
            <div className="chart-sub">Calories in vs walk burn · 1600 kcal target</div>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.dailyCalories}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#c8d6e8" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend />
                  <ReferenceLine y={1600} stroke="#4a6080" strokeDasharray="4 4" label={{ value: '1600 kcal', fill: '#4a6080', fontSize: 10 }} />
                  <ReferenceLine y={data.tdeeBaseline} stroke="#4a6080" strokeDasharray="8 4" label={{ value: 'BMR baseline', fill: '#4a6080', fontSize: 10 }} />
                  <Bar dataKey="calories" name="Calories In" fill="#2980b9" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="burnKcal" name="Walk Burn" stroke="#e67e22" strokeDasharray="5 3" dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {data.dailyCalories.length > 0 && (() => {
              const daysWithCals = data.dailyCalories.filter(d => d.calories > 0)
              const avgNet = daysWithCals.length > 0
                ? Math.round(daysWithCals.reduce((s, d) => s + d.calories, 0) / daysWithCals.length)
                : 0
              const avgBurn = daysWithCals.length > 0
                ? Math.round(daysWithCals.reduce((s, d) => s + (d.burnKcal ?? 0), 0) / daysWithCals.length)
                : 0
              const avgDeficit = data.tdeeBaseline + avgBurn - avgNet
              const deficitColor = avgDeficit > 0 ? 'var(--green)' : 'var(--red)'
              return (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                  Avg net calories: {avgNet} kcal/day &nbsp;·&nbsp;{' '}
                  <span style={{ color: deficitColor }}>
                    Avg deficit vs baseline: {avgDeficit > 0 ? '+' : ''}{avgDeficit} kcal/day
                  </span>
                </div>
              )
            })()}
          </div>

          {/* Hydration */}
          <div className="chart-card">
            <div className="chart-title">Hydration</div>
            <div className="chart-sub">vs 100 oz target</div>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.hydrationTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#c8d6e8" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <ReferenceLine y={100} stroke="#1a7a4a" strokeDasharray="4 4" label={{ value: '100oz', fill: '#1a7a4a', fontSize: 10 }} />
                  <Area type="monotone" dataKey="hydration" stroke="#2980b9" fill="rgba(41,128,185,0.15)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
              Avg {data.hydrationAvg}oz/day — hit target {data.hydrationTargetPct}% of days
            </div>
          </div>

          {/* Walking */}
          <div className="chart-card">
            <div className="chart-title">Walking</div>
            <div className="chart-sub">Miles per day</div>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.walkTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#c8d6e8" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="walkMiles" fill="#2980b9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
              {data.walkTotal} total miles — {data.walkCount} walks logged — avg {data.walkAvg} miles/walk
            </div>
          </div>

          {/* Walk Heart Rate Trend */}
          <div className="chart-card">
            <div className="chart-title">Walk Heart Rate Trend</div>
            <div className="chart-sub">Avg bpm per walk</div>
            {data.walkHRTrend.length < 3 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
                Log more walks with HR to see trends
              </div>
            ) : (
              <>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.walkHRTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#c8d6e8" />
                      <XAxis dataKey="date" tickFormatter={fmtDate} {...AXIS_STYLE} />
                      <YAxis {...AXIS_STYLE} domain={['auto', 'auto']} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <ReferenceArea y1={100} y2={120} fill="rgba(160,120,0,0.08)" label={{ value: 'Moderate', fill: '#a07800', fontSize: 10, position: 'insideTopRight' }} />
                      <ReferenceArea y1={120} y2={140} fill="rgba(26,122,74,0.08)" label={{ value: 'Brisk ✓', fill: '#1a7a4a', fontSize: 10, position: 'insideTopRight' }} />
                      <ReferenceArea y1={140} y2={200} fill="rgba(176,32,32,0.06)" label={{ value: 'Vigorous', fill: '#b02020', fontSize: 10, position: 'insideTopRight' }} />
                      <Line type="monotone" dataKey="walkAvgHR" name="Avg HR" stroke="var(--red)" strokeWidth={2} dot={{ r: 4, fill: 'var(--red)' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {data.walkHRAvg != null && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                    Avg walk HR: {data.walkHRAvg}bpm over this period
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
