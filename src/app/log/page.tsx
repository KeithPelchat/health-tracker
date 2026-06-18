'use client'

import { useEffect, useState, useCallback } from 'react'
import { toChicagoDateStr, formatChicagoDisplay } from '@/lib/dates'

interface Meal {
  id: number
  name: string
  category: string
  proteinPer100g?: number | null
  fatPer100g?: number | null
  carbsPer100g?: number | null
  calsPer100g?: number | null
  proteinPerUnit?: number | null
  fatPerUnit?: number | null
  carbsPerUnit?: number | null
  calsPerUnit?: number | null
  unitLabel?: string | null
  carbsPer100gVeg?: number | null
  calsPer100gVeg?: number | null
  proteinFixed?: number | null
  fatFixed?: number | null
  carbsFixed?: number | null
  calsFixed?: number | null
  portionLabel?: string | null
  isCustom: boolean
}

interface FoodEntry {
  id: number
  date: string
  mealSlot: string
  mealId: number | null
  meal: Meal | null
  customDesc: string | null
  protein: number
  fat: number
  netCarbs: number
  calories: number
}

interface BristolEntry {
  id: number
  date: string
  value: number
  timeOfDay: string | null
}

interface DailyLog {
  weight?: number | null
  bodyFat?: number | null
  bpSys?: number | null
  bpDia?: number | null
  rhr?: number | null
  sleepScore?: number | null
  sleepHours?: number | null
  sleepMins?: number | null
  sleepQuality?: string | null
  amSupp?: boolean | null
  pmSupp?: boolean | null
  hydration?: number | null
  walkMiles?: number | null
  walkMins?: number | null
  walkSecs?: number | null
  walkAvgHR?: number | null
  notes?: string | null
}

const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner']

const BRISTOL_LABELS: Record<number, string> = {
  1: 'Separate hard lumps',
  2: 'Lumpy sausage',
  3: 'Cracked sausage',
  4: 'Smooth sausage',
  5: 'Soft blobs',
  6: 'Fluffy pieces',
  7: 'Watery',
}

const BRISTOL_SHORT: { v: number; label: string }[] = [
  { v: 1, label: 'Hard' },
  { v: 2, label: 'Lumpy' },
  { v: 3, label: 'Cracked' },
  { v: 4, label: 'Smooth ✓' },
  { v: 5, label: 'Soft' },
  { v: 6, label: 'Fluffy' },
  { v: 7, label: 'Watery' },
]

function offsetDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function getDateLabel(dateStr: string, todayStr: string): string {
  const diffMs = new Date(todayStr + 'T00:00:00Z').getTime() - new Date(dateStr + 'T00:00:00Z').getTime()
  const diffDays = Math.round(diffMs / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long' })
}

// ── MealLogPanel Component ──────────────────────────────────────────────────

interface MealLogPanelProps {
  meal: Meal
  today: string
  openSlot: string
  onLogged: () => void
  onCancel: () => void
}

function MealLogPanel({ meal, today, openSlot, onLogged, onCancel }: MealLogPanelProps) {
  const [ozOrG, setOzOrG] = useState<'oz' | 'g'>('oz')
  const [weightInput, setWeightInput] = useState('')
  const [countInput, setCountInput] = useState('1')
  const [portionsInput, setPortionsInput] = useState('1')
  const [saveAsNew, setSaveAsNew] = useState(false)
  const [newMealName, setNewMealName] = useState('')
  const [saving, setSaving] = useState(false)

  const grams = meal.category === 'protein' || meal.category === 'vegetable'
    ? (ozOrG === 'oz' ? (Number(weightInput) || 0) * 28.35 : (Number(weightInput) || 0))
    : 0
  const count = meal.category === 'countable' ? (Number(countInput) || 1) : 1
  const portions = meal.category === 'condiment' ? (Number(portionsInput) || 1) : 1

  let adjProtein = 0, adjFat = 0, adjNetCarbs = 0, adjCalories = 0
  if (meal.category === 'protein') {
    adjProtein  = Math.round((meal.proteinPer100g! / 100) * grams * 10) / 10
    adjFat      = Math.round((meal.fatPer100g! / 100) * grams * 10) / 10
    adjNetCarbs = Math.round((meal.carbsPer100g! / 100) * grams * 10) / 10
    adjCalories = Math.round((meal.calsPer100g! / 100) * grams)
  } else if (meal.category === 'countable') {
    adjProtein  = Math.round(meal.proteinPerUnit! * count * 10) / 10
    adjFat      = Math.round(meal.fatPerUnit! * count * 10) / 10
    adjNetCarbs = Math.round(meal.carbsPerUnit! * count * 10) / 10
    adjCalories = Math.round(meal.calsPerUnit! * count)
  } else if (meal.category === 'vegetable') {
    adjProtein  = 0
    adjFat      = 0
    adjNetCarbs = Math.round((meal.carbsPer100gVeg! / 100) * grams * 10) / 10
    adjCalories = Math.round((meal.calsPer100gVeg! / 100) * grams)
  } else if (meal.category === 'condiment') {
    adjProtein  = Math.round(meal.proteinFixed! * portions * 10) / 10
    adjFat      = Math.round(meal.fatFixed! * portions * 10) / 10
    adjNetCarbs = Math.round(meal.carbsFixed! * portions * 10) / 10
    adjCalories = Math.round(meal.calsFixed! * portions)
  }

  const canLog = adjCalories > 0 || adjProtein > 0 || adjNetCarbs > 0

  async function handleLog() {
    setSaving(true)
    if (saveAsNew && (meal.category === 'protein' || meal.category === 'countable')) {
      const name = newMealName.trim() || `${meal.name} (custom)`
      const mRes = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, category: 'countable', unitLabel: 'serving',
          proteinPerUnit: adjProtein, fatPerUnit: adjFat,
          carbsPerUnit: adjNetCarbs, calsPerUnit: adjCalories,
          isCustom: true,
        }),
      }).then(r => r.json())
      await fetch('/api/food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today, mealSlot: openSlot, mealId: mRes.meal?.id ?? null,
          customDesc: name, protein: adjProtein, fat: adjFat,
          netCarbs: adjNetCarbs, calories: adjCalories,
        }),
      })
    } else {
      await fetch('/api/food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today, mealSlot: openSlot, mealId: meal.id,
          protein: adjProtein, fat: adjFat,
          netCarbs: adjNetCarbs, calories: adjCalories,
        }),
      })
    }
    setSaving(false)
    onLogged()
  }

  return (
    <div className="meal-preview">
      <div className="meal-preview-name">{meal.name}</div>

      {meal.category === 'protein' && (
        <>
          <div className="meal-preview-base" style={{ marginBottom: 12 }}>Protein source — macros by cooked weight</div>
          <div className="field-col" style={{ marginBottom: 8 }}>
            <label className="field-lbl">Cooked weight</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" type="number" step="0.5" placeholder="0" value={weightInput}
                onChange={e => setWeightInput(e.target.value)} style={{ flex: 1 }} />
              <div className="toggle-grp" style={{ width: 100 }}>
                <button className={`tog${ozOrG === 'oz' ? ' blue' : ''}`} onClick={() => setOzOrG('oz')} style={{ padding: '10px 8px' }}>oz</button>
                <button className={`tog${ozOrG === 'g' ? ' blue' : ''}`} onClick={() => setOzOrG('g')} style={{ padding: '10px 8px' }}>g</button>
              </div>
            </div>
          </div>
        </>
      )}

      {meal.category === 'countable' && (
        <div className="field-col" style={{ marginBottom: 8 }}>
          <label className="field-lbl">How many {meal.unitLabel ?? 'units'}?</label>
          <input className="input" type="number" step="1" min="1" placeholder="1" value={countInput}
            onChange={e => setCountInput(e.target.value)} />
        </div>
      )}

      {meal.category === 'vegetable' && (
        <>
          <div className="meal-preview-base" style={{ marginBottom: 12 }}>Vegetable — net carbs by cooked weight</div>
          <div className="field-col" style={{ marginBottom: 8 }}>
            <label className="field-lbl">Cooked weight</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" type="number" step="0.5" placeholder="0" value={weightInput}
                onChange={e => setWeightInput(e.target.value)} style={{ flex: 1 }} />
              <div className="toggle-grp" style={{ width: 100 }}>
                <button className={`tog${ozOrG === 'oz' ? ' blue' : ''}`} onClick={() => setOzOrG('oz')} style={{ padding: '10px 8px' }}>oz</button>
                <button className={`tog${ozOrG === 'g' ? ' blue' : ''}`} onClick={() => setOzOrG('g')} style={{ padding: '10px 8px' }}>g</button>
              </div>
            </div>
          </div>
        </>
      )}

      {meal.category === 'condiment' && (
        <div className="field-col" style={{ marginBottom: 8 }}>
          <label className="field-lbl">How many portions? ({meal.portionLabel})</label>
          <input className="input" type="number" step="1" min="1" placeholder="1" value={portionsInput}
            onChange={e => setPortionsInput(e.target.value)} />
        </div>
      )}

      {canLog && (
        <div className="adjusted-macros">
          → P{adjProtein}g · F{adjFat}g · NC{adjNetCarbs}g · {adjCalories}kcal
        </div>
      )}

      {saveAsNew && (meal.category === 'protein' || meal.category === 'countable') && (
        <div className="field-col" style={{ marginBottom: 12, marginTop: 8 }}>
          <label className="field-lbl">Save as meal name</label>
          <input className="input" value={newMealName}
            onChange={e => setNewMealName(e.target.value)}
            placeholder={`${meal.name} (custom)`} />
        </div>
      )}

      <div className="preview-actions" style={{ marginTop: 12 }}>
        <button className="btn-primary" onClick={handleLog} disabled={saving || !canLog}>
          {saving ? 'Logging…' : 'Log It'}
        </button>
        {(meal.category === 'protein' || meal.category === 'countable') && (
          <button className="btn-ghost" onClick={() => { setSaveAsNew(s => !s); setNewMealName('') }}>
            {saveAsNew ? 'Cancel save' : 'Save as New Meal'}
          </button>
        )}
      </div>
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
          onClick={onCancel}>
          ← Back to list
        </button>
      </div>
    </div>
  )
}

// ── LogPage Component ───────────────────────────────────────────────────────

export default function LogPage() {
  const todayStr = toChicagoDateStr()
  const [selectedDate, setSelectedDate] = useState(() => toChicagoDateStr())
  const isToday = selectedDate === todayStr
  const dateLabel = getDateLabel(selectedDate, todayStr)
  const minDate = offsetDateStr(todayStr, -2)
  const canGoPrev = selectedDate > minDate
  const canGoNext = selectedDate < todayStr

  const [log, setLog] = useState<DailyLog>({})
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([])
  const [bristolEntries, setBristolEntries] = useState<BristolEntry[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [recentWeight, setRecentWeight] = useState<number | null>(null)

  const [openSlot, setOpenSlot] = useState<string | null>(null)
  const [slotMode, setSlotMode] = useState<'select' | 'custom'>('select')
  const [mealSearch, setMealSearch] = useState('')
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null)
  const [customEntry, setCustomEntry] = useState({ desc: '', protein: '', fat: '', netCarbs: '', calories: '', saveAsMeal: false })
  const [customLooking, setCustomLooking] = useState(false)
  const [customAutoFilled, setCustomAutoFilled] = useState(false)

  const [saving, setSaving] = useState(false)
  const [showToast, setShowToast] = useState(false)

  const [bristolOpen, setBristolOpen] = useState(false)
  const [bristolVal, setBristolVal] = useState<number | null>(null)
  const [bristolTime, setBristolTime] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = useCallback(async () => {
    const [logRes, foodRes, bristolRes, mealsRes] = await Promise.all([
      fetch(`/api/log?date=${selectedDate}`).then(r => r.json()),
      fetch(`/api/food?date=${selectedDate}`).then(r => r.json()),
      fetch(`/api/bristol?date=${selectedDate}`).then(r => r.json()),
      fetch('/api/meals').then(r => r.json()),
    ])
    if (logRes.log) setLog(logRes.log)
    else setLog({})
    if (logRes.recentWeight != null) setRecentWeight(logRes.recentWeight)
    setFoodEntries(foodRes.entries || [])
    setBristolEntries(bristolRes.entries || [])
    setMeals(mealsRes.meals || [])
  }, [selectedDate])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const onFocus = () => fetchAll()
    const onVisibility = () => { if (document.visibilityState === 'visible') fetchAll() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fetchAll])

  // Macro totals
  const totalProtein = foodEntries.reduce((s, e) => s + e.protein, 0)
  const totalCarbs = foodEntries.reduce((s, e) => s + e.netCarbs, 0)
  const totalFat = foodEntries.reduce((s, e) => s + e.fat, 0)
  const totalCals = foodEntries.reduce((s, e) => s + e.calories, 0)

  const proteinFill = Math.min((totalProtein / 170) * 100, 100)
  const carbsFill = Math.min((totalCarbs / 82) * 100, 100)
  const fatFill = Math.min((totalFat / 90) * 100, 100)
  const calsFill = Math.min((totalCals / 1600) * 100, 100)

  // Walk burn calc
  const effectiveWeight = (log.weight as number | null) ?? recentWeight
  const walkTotalSecs = ((log.walkMins ?? 0) * 60) + (log.walkSecs ?? 0)
  const walkBurnKcal = (effectiveWeight && walkTotalSecs > 0)
    ? Math.round(3.8 * (effectiveWeight / 2.205) * (walkTotalSecs / 3600))
    : null

  // TDEE baseline (Mifflin-St Jeor, sedentary)
  const tdeeWeightKg = effectiveWeight != null ? effectiveWeight / 2.205 : 99.3
  const birthDate = new Date(Date.UTC(1965, 0, 21))
  const nowDate = new Date()
  let ageYears = nowDate.getFullYear() - birthDate.getFullYear()
  const ageM = nowDate.getMonth() - birthDate.getMonth()
  if (ageM < 0 || (ageM === 0 && nowDate.getDate() < birthDate.getDate())) ageYears--
  const tdeeBaseline = Math.round(((10 * tdeeWeightKg) + (6.25 * 166.4) - (5 * ageYears) + 5) * 1.2)

  const totalCaloriesOut = tdeeBaseline + (walkBurnKcal ?? 0)
  const netCals = totalCals - totalCaloriesOut

  // Walk HR zone label
  const walkHR = log.walkAvgHR as number | null | undefined
  function getHRZone(hr: number): { label: string; color: string } {
    if (hr < 100) return { label: 'Easy pace', color: 'var(--text-muted)' }
    if (hr < 120) return { label: 'Moderate', color: 'var(--gold)' }
    if (hr < 140) return { label: 'Brisk ✓', color: 'var(--green)' }
    if (hr < 160) return { label: 'Vigorous', color: 'var(--sky)' }
    return { label: 'High intensity', color: 'var(--red)' }
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...log, date: selectedDate }),
    })
    setSaving(false)
    if (res.ok) {
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
    }
  }

  async function handleCustomLookup() {
    setCustomLooking(true)
    const res = await fetch('/api/meals/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: customEntry.desc, category: 'countable' }),
    }).then(r => r.json())
    setCustomLooking(false)
    if (!res.error) {
      setCustomEntry(p => ({
        ...p,
        protein: res.protein != null ? String(res.protein) : p.protein,
        fat: res.fat != null ? String(res.fat) : p.fat,
        netCarbs: res.netCarbs != null ? String(res.netCarbs) : p.netCarbs,
        calories: res.calories != null ? String(res.calories) : p.calories,
      }))
      setCustomAutoFilled(true)
    }
  }

  async function addCustomEntry() {
    let mealId = null
    if (customEntry.saveAsMeal && customEntry.desc) {
      const mRes = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customEntry.desc,
          category: 'countable',
          proteinPerUnit: Number(customEntry.protein),
          fatPerUnit: Number(customEntry.fat),
          carbsPerUnit: Number(customEntry.netCarbs),
          calsPerUnit: Number(customEntry.calories),
          unitLabel: 'serving',
          isCustom: true,
        }),
      }).then(r => r.json())
      mealId = mRes.meal?.id ?? null
    }
    await fetch('/api/food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: selectedDate,
        mealSlot: openSlot,
        mealId,
        customDesc: customEntry.desc || null,
        protein: Number(customEntry.protein) || 0,
        fat: Number(customEntry.fat) || 0,
        netCarbs: Number(customEntry.netCarbs) || 0,
        calories: Number(customEntry.calories) || 0,
      }),
    })
    setOpenSlot(null)
    setCustomEntry({ desc: '', protein: '', fat: '', netCarbs: '', calories: '', saveAsMeal: false })
    setCustomAutoFilled(false)
    const res = await fetch(`/api/food?date=${selectedDate}`).then(r => r.json())
    setFoodEntries(res.entries || [])
    const mealsRes = await fetch('/api/meals').then(r => r.json())
    setMeals(mealsRes.meals || [])
  }

  async function deleteFood(id: number) {
    await fetch(`/api/food/${id}`, { method: 'DELETE' })
    setFoodEntries(prev => prev.filter(e => e.id !== id))
  }

  async function addBristol() {
    if (!bristolVal) return
    await fetch('/api/bristol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: selectedDate, value: bristolVal, timeOfDay: bristolTime || null }),
    })
    setBristolOpen(false)
    setBristolVal(null)
    setBristolTime('')
    const res = await fetch(`/api/bristol?date=${selectedDate}`).then(r => r.json())
    setBristolEntries(res.entries || [])
  }

  async function deleteBristol(id: number) {
    await fetch(`/api/bristol/${id}`, { method: 'DELETE' })
    setBristolEntries(prev => prev.filter(e => e.id !== id))
  }

  function setLogField(field: keyof DailyLog, val: string | boolean | number | null) {
    setLog(prev => ({ ...prev, [field]: val }))
  }

  function handleSupp(field: 'amSupp' | 'pmSupp', clicked: boolean) {
    const current = log[field]
    if (current === clicked) {
      setLogField(field, null)
    } else {
      setLogField(field, clicked)
    }
  }

  // Hydration — 8oz per glass, 13 glasses (104oz max, 100oz target)
  const glassesFilled = Math.round((Number(log.hydration) || 0) / 8)

  function handleGlass(i: number) {
    if (i < glassesFilled) {
      setLogField('hydration', String(i * 8))
    } else {
      setLogField('hydration', String((i + 1) * 8))
    }
  }

  const filteredMeals = meals.filter(m =>
    m.name.toLowerCase().includes(mealSearch.toLowerCase())
  )

  const navBtnStyle = (enabled: boolean) => ({
    background: 'none', border: 'none',
    cursor: enabled ? 'pointer' : 'default',
    color: enabled ? 'var(--navy)' : 'var(--border)',
    fontSize: 22, padding: '2px 12px', lineHeight: 1,
    fontWeight: 700,
  } as React.CSSProperties)

  return (
    <div className="page">
      {/* HEADER */}
      <div className="page-hdr">
        <button className={`refresh-btn${refreshing ? ' spinning' : ''}`} onClick={handleRefresh} aria-label="Refresh">↻</button>
        <h1 className="page-title">Daily Log{!isToday ? ` — ${dateLabel}` : ''}</h1>
        <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0 2px' }}>
          <button style={navBtnStyle(canGoPrev)} onClick={() => canGoPrev && setSelectedDate(offsetDateStr(selectedDate, -1))} disabled={!canGoPrev} aria-label="Previous day">←</button>
          <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15, color: 'var(--sky)' }}>{dateLabel}</span>
          <button style={navBtnStyle(canGoNext)} onClick={() => canGoNext && setSelectedDate(offsetDateStr(selectedDate, 1))} disabled={!canGoNext} aria-label="Next day">→</button>
        </div>
        <div className="page-sub" style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>{formatChicagoDisplay(selectedDate)}</div>
        <div className="page-accent" />
      </div>

      {/* EDITING BANNER */}
      {!isToday && (
        <div style={{
          background: 'var(--gold-bg)', color: 'var(--navy)',
          fontSize: 13, textAlign: 'center', padding: 8,
          width: '100%', marginBottom: 16, borderRadius: 8,
          fontWeight: 700,
        }}>
          Editing {formatChicagoDisplay(selectedDate)}
        </div>
      )}

      {/* MACRO SUMMARY */}
      <div className="card card-macro">
        <div className="section-label">Macro Summary</div>
        <div className="progress-wrap">
          <div className="progress-header">
            <span className="progress-name">Protein</span>
            <span className="progress-val">{Math.round(totalProtein)}g / 170g</span>
          </div>
          <div className="progress-bar">
            <div className={`progress-fill${totalProtein >= 170 ? ' green' : ''}`} style={{ width: `${proteinFill}%` }} />
          </div>
          <div className={`progress-remain${totalProtein >= 170 ? ' hit' : ''}`}>
            {totalProtein >= 170 ? '✓ Hit!' : `+${Math.round(170 - totalProtein)}g to go`}
          </div>
        </div>
        <div className="progress-wrap">
          <div className="progress-header">
            <span className="progress-name">Net Carbs</span>
            <span className="progress-val">{Math.round(totalCarbs)}g / 82g</span>
          </div>
          <div className="progress-bar">
            <div className={`progress-fill${totalCarbs > 82 ? ' red' : ''}`} style={{ width: `${carbsFill}%` }} />
          </div>
          <div className={`progress-remain${totalCarbs > 82 ? ' over' : ''}`}>
            {totalCarbs > 82 ? `${Math.round(totalCarbs - 82)}g over` : `${Math.round(82 - totalCarbs)}g under`}
          </div>
        </div>
        <div className="progress-wrap">
          <div className="progress-header">
            <span className="progress-name">Fat</span>
            <span className="progress-val">{Math.round(totalFat)}g / 90g</span>
          </div>
          <div className="progress-bar">
            <div className={`progress-fill${totalFat > 90 ? ' orange' : ''}`} style={{ width: `${fatFill}%` }} />
          </div>
          <div className={`progress-remain${totalFat > 90 ? ' over' : ''}`}>
            {totalFat > 90 ? `${Math.round(totalFat - 90)}g over` : `${Math.round(90 - totalFat)}g under`}
          </div>
        </div>
        <div className="progress-wrap" style={{ marginBottom: 0 }}>
          <div className="progress-header">
            <span className="progress-name">Calories</span>
            <span className="progress-val">{totalCals} kcal / 1600</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${calsFill}%` }} />
          </div>
          <div className="progress-remain">{totalCals} kcal</div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600 }}>
            <span style={{ color: 'var(--text-muted)' }}>Calories In</span>
            <span>{totalCals} kcal</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600 }}>
            <span style={{ color: 'var(--text-muted)' }}>Calories Out</span>
            <span>~{totalCaloriesOut} kcal</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', paddingLeft: 16 }}>
            <span>Baseline</span>
            <span>~{tdeeBaseline} kcal (BMR × 1.2)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', paddingLeft: 16 }}>
            <span>Walk burn</span>
            <span>{walkBurnKcal !== null ? `~${walkBurnKcal} kcal` : '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800 }}>
            <span style={{ color: 'var(--text-muted)' }}>Net</span>
            <span style={{ color: netCals < 1400 ? 'var(--green)' : netCals > 1600 ? 'var(--orange)' : 'var(--text)' }}>
              {netCals} kcal
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>* Baseline uses BMR × 1.2 (sedentary). Walk burn adds MET 3.8 estimate.</div>
        </div>
      </div>

      <button className="btn-primary" style={{ background: 'var(--green)', boxShadow: '0 4px 12px rgba(26,122,74,0.3)' }} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : isToday ? 'Save Check-in' : `Update ${dateLabel}`}
      </button>

      {/* BIOMETRICS */}
      <div className="card card-bio">
        <div className="section-label">Biometrics</div>
        <div className="field-row">
          <div className="field-col">
            <label className="field-lbl">Weight (lbs)</label>
            <input className="input" type="number" step="0.1" placeholder="—" value={log.weight ?? ''} onChange={e => setLogField('weight', e.target.value)} />
          </div>
          <div className="field-col">
            <label className="field-lbl">Body Fat %</label>
            <input className="input" type="number" step="0.1" placeholder="—" value={log.bodyFat ?? ''} onChange={e => setLogField('bodyFat', e.target.value)} />
          </div>
        </div>
        <div className="field-row">
          <div className="field-col">
            <label className="field-lbl">BP Systolic</label>
            <input className="input" type="number" placeholder="—" value={log.bpSys ?? ''} onChange={e => setLogField('bpSys', e.target.value)} />
          </div>
          <div className="field-col">
            <label className="field-lbl">BP Diastolic</label>
            <input className="input" type="number" placeholder="—" value={log.bpDia ?? ''} onChange={e => setLogField('bpDia', e.target.value)} />
          </div>
          <div className="field-col">
            <label className="field-lbl">RHR</label>
            <input className="input" type="number" placeholder="—" value={log.rhr ?? ''} onChange={e => setLogField('rhr', e.target.value)} />
          </div>
        </div>
      </div>

      {/* SLEEP */}
      <div className="card card-sleep">
        <div className="section-label">Sleep</div>
        {(log.sleepScore != null) && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 48, fontWeight: 800,
              color: (log.sleepScore as number) >= 80 ? 'var(--green)' : (log.sleepScore as number) >= 60 ? 'var(--gold)' : 'var(--red)'
            }}>
              {log.sleepScore}
            </span>
            {log.sleepQuality && (
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-muted)' }}>{log.sleepQuality}</span>
            )}
          </div>
        )}
        <div className="field-row">
          <div className="field-col">
            <label className="field-lbl">Sleep Score</label>
            <input className="input" type="number" min="0" max="100" placeholder="—"
              value={log.sleepScore ?? ''}
              onChange={e => setLogField('sleepScore', e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div className="field-col">
            <label className="field-lbl">Duration</label>
            <div className="walk-time-row">
              <input className="input walk-time-input" type="number" min="0" max="24" placeholder="0"
                value={log.sleepHours ?? ''}
                onChange={e => setLogField('sleepHours', e.target.value ? Number(e.target.value) : null)} />
              <span className="walk-time-sep">h</span>
              <input className="input walk-time-input" type="number" min="0" max="59" placeholder="0"
                value={log.sleepMins ?? ''}
                onChange={e => setLogField('sleepMins', e.target.value ? Number(e.target.value) : null)} />
              <span className="walk-time-sep">m</span>
            </div>
          </div>
        </div>
        <div>
          <label className="field-lbl" style={{ marginBottom: 8, display: 'block' }}>Sleep Quality</label>
          <div className="toggle-grp">
            {(['High', 'OK', 'Poor'] as const).map(q => {
              const isActive = log.sleepQuality === q
              const activeStyle = q === 'High' ? 'yes' : q === 'Poor' ? 'no' : 'gold'
              return (
                <button key={q}
                  className={`tog${isActive ? ` ${activeStyle}` : ''}`}
                  onClick={() => setLogField('sleepQuality', log.sleepQuality === q ? null : q)}>
                  {q}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* FOOD LOG */}
      <div className="card card-food">
        <div className="section-label">Food Log</div>
        {SLOTS.map(slot => {
          const slotEntries = foodEntries.filter(e => e.mealSlot === slot)
          const slotP = slotEntries.reduce((s, e) => s + e.protein, 0)
          const slotC = slotEntries.reduce((s, e) => s + e.netCarbs, 0)
          const slotF = slotEntries.reduce((s, e) => s + e.fat, 0)
          return (
            <div key={slot} className="meal-slot">
              <div className="slot-header">
                <span className="slot-name">{slot}</span>
                {slotEntries.length > 0 && (
                  <span className="slot-total">P{Math.round(slotP)}g C{Math.round(slotC)}g F{Math.round(slotF)}g</span>
                )}
              </div>
              {slotEntries.map(e => (
                <div key={e.id} className="food-entry-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="food-entry-name">{e.meal?.name || e.customDesc || 'Custom'}</div>
                    <div className="food-macros">P{e.protein}g · F{e.fat}g · C{e.netCarbs}g · {e.calories}kcal</div>
                  </div>
                  <button className="btn-danger" onClick={() => deleteFood(e.id)}>✕</button>
                </div>
              ))}
              {openSlot !== slot && (
                <button className="btn-add-slot" onClick={() => { setOpenSlot(slot); setSlotMode('select'); setSelectedMeal(null); setMealSearch(''); }}>
                  ＋ Add {slot}
                </button>
              )}
              {openSlot === slot && (
                <div className="add-panel">
                  <div className="mode-tabs">
                    <button className={`mode-tab${slotMode === 'select' ? ' active' : ''}`} onClick={() => { setSlotMode('select'); setSelectedMeal(null); }}>Select Meal</button>
                    <button className={`mode-tab${slotMode === 'custom' ? ' active' : ''}`} onClick={() => setSlotMode('custom')}>Custom Entry</button>
                  </div>
                  {slotMode === 'select' && (
                    <>
                      <input
                        className="input"
                        placeholder="Search meals…"
                        value={mealSearch}
                        onChange={e => { setMealSearch(e.target.value); setSelectedMeal(null); }}
                      />
                      {selectedMeal ? (
                        <MealLogPanel
                          meal={selectedMeal}
                          today={selectedDate}
                          openSlot={openSlot!}
                          onLogged={async () => {
                            setOpenSlot(null)
                            setSelectedMeal(null)
                            setMealSearch('')
                            const res = await fetch(`/api/food?date=${selectedDate}`).then(r => r.json())
                            setFoodEntries(res.entries || [])
                            const mealsRes = await fetch('/api/meals').then(r => r.json())
                            setMeals(mealsRes.meals || [])
                          }}
                          onCancel={() => { setSelectedMeal(null); setMealSearch(''); }}
                        />
                      ) : (
                        <div className="meal-search-list">
                          {filteredMeals.map(m => (
                            <div key={m.id} className="meal-opt" onClick={() => { setSelectedMeal(m); }}>
                              <div className="meal-opt-name">
                                {m.name}
                                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--sky)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                  {m.category}
                                </span>
                              </div>
                              <div className="meal-opt-macros">
                                {m.category === 'protein' && `P:${m.proteinPer100g}g F:${m.fatPer100g}g NC:${m.carbsPer100g}g ${m.calsPer100g}kcal / 100g`}
                                {m.category === 'countable' && `P:${m.proteinPerUnit}g F:${m.fatPerUnit}g NC:${m.carbsPerUnit}g ${m.calsPerUnit}kcal / ${m.unitLabel ?? 'unit'}`}
                                {m.category === 'vegetable' && `NC:${m.carbsPer100gVeg}g ${m.calsPer100gVeg}kcal / 100g`}
                                {m.category === 'condiment' && `P:${m.proteinFixed}g F:${m.fatFixed}g NC:${m.carbsFixed}g ${m.calsFixed}kcal / ${m.portionLabel ?? 'portion'}`}
                              </div>
                            </div>
                          ))}
                          {filteredMeals.length === 0 && <div className="empty" style={{ padding: '16px 0' }}>No meals found</div>}
                        </div>
                      )}
                    </>
                  )}
                  {slotMode === 'custom' && (
                    <>
                      <div className="field-col" style={{ marginBottom: 10 }}>
                        <label className="field-lbl">Description</label>
                        <input className="input" placeholder="Food description" value={customEntry.desc}
                          onChange={e => { setCustomEntry(p => ({ ...p, desc: e.target.value })); setCustomAutoFilled(false) }} />
                      </div>
                      {customEntry.desc.length >= 3 && (
                        <div style={{ marginBottom: 10 }}>
                          <button
                            className="btn-add-slot"
                            style={{ marginTop: 0 }}
                            onClick={handleCustomLookup}
                            disabled={customLooking}
                          >
                            {customLooking ? 'Looking up…' : '🔍 Look up nutrition'}
                          </button>
                          {customAutoFilled && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>
                              ⚠️ AI estimate — verify if precision matters
                            </div>
                          )}
                        </div>
                      )}
                      <div className="field-row">
                        <div className="field-col">
                          <label className="field-lbl">Protein (g)</label>
                          <input className="input" type="number" step="0.1" value={customEntry.protein}
                            style={{ background: customAutoFilled ? 'var(--sky-light)' : undefined }}
                            onChange={e => setCustomEntry(p => ({ ...p, protein: e.target.value }))} />
                        </div>
                        <div className="field-col">
                          <label className="field-lbl">Fat (g)</label>
                          <input className="input" type="number" step="0.1" value={customEntry.fat}
                            style={{ background: customAutoFilled ? 'var(--sky-light)' : undefined }}
                            onChange={e => setCustomEntry(p => ({ ...p, fat: e.target.value }))} />
                        </div>
                      </div>
                      <div className="field-row">
                        <div className="field-col">
                          <label className="field-lbl">Net Carbs (g)</label>
                          <input className="input" type="number" step="0.1" value={customEntry.netCarbs}
                            style={{ background: customAutoFilled ? 'var(--sky-light)' : undefined }}
                            onChange={e => setCustomEntry(p => ({ ...p, netCarbs: e.target.value }))} />
                        </div>
                        <div className="field-col">
                          <label className="field-lbl">Calories</label>
                          <input className="input" type="number" value={customEntry.calories}
                            style={{ background: customAutoFilled ? 'var(--sky-light)' : undefined }}
                            onChange={e => setCustomEntry(p => ({ ...p, calories: e.target.value }))} />
                        </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={customEntry.saveAsMeal} onChange={e => setCustomEntry(p => ({ ...p, saveAsMeal: e.target.checked }))} />
                        Save as meal for future use
                      </label>
                      <button className="btn-primary" onClick={addCustomEntry}>Add to Log</button>
                    </>
                  )}
                  <div style={{ textAlign: 'center', marginTop: 10 }}>
                    <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }} onClick={() => { setOpenSlot(null); setCustomAutoFilled(false) }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button className="btn-primary" style={{ background: 'var(--green)', boxShadow: '0 4px 12px rgba(26,122,74,0.3)' }} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : isToday ? 'Save Check-in' : `Update ${dateLabel}`}
      </button>

      {/* BRISTOL */}
      <div className="card card-bristol">
        <div className="section-label">GI / Bristol Scale</div>
        {bristolEntries.length === 0 && !bristolOpen && (
          <div className="empty" style={{ padding: '12px 0' }}>No entries yet today</div>
        )}
        {bristolEntries.map(b => {
          const isGood = b.value === 4
          const isBad = [1, 2, 6, 7].includes(b.value)
          return (
            <div key={b.id} className="bristol-entry-row">
              <div>
                <div className="bristol-entry-info" style={{ color: isGood ? 'var(--green)' : isBad ? 'var(--red)' : 'var(--text)' }}>
                  Bristol {b.value} — {BRISTOL_LABELS[b.value]}
                </div>
                {b.timeOfDay && <div className="bristol-entry-meta">{b.timeOfDay}</div>}
              </div>
              <button className="btn-danger" onClick={() => deleteBristol(b.id)}>✕</button>
            </div>
          )
        })}
        {!bristolOpen && (
          <button className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setBristolOpen(true)}>+ Add Entry</button>
        )}
        {bristolOpen && (
          <div className="add-panel" style={{ marginTop: 10 }}>
            <div className="section-label">Select Type</div>
            <div className="bristol-row">
              {BRISTOL_SHORT.map(({ v, label }) => (
                <button key={v} className={`bristol-pill${bristolVal === v ? (v === 4 ? ' sel-good' : [1,2,6,7].includes(v) ? ' sel-bad' : ' sel-default') : ''}`} onClick={() => setBristolVal(v)}>{v} · {label}</button>
              ))}
            </div>
            {bristolVal && (
              <div className={`bristol-lbl ${bristolVal === 4 ? 'ok' : [1,2,6,7].includes(bristolVal) ? 'bad' : ''}`}>
                {BRISTOL_LABELS[bristolVal]}
              </div>
            )}
            <div className="toggle-grp" style={{ marginTop: 12 }}>
              {['Morning', 'Afternoon', 'Evening', '—'].map(t => (
                <button key={t} className={`tog${bristolTime === t ? ' blue' : ''}`} onClick={() => setBristolTime(bristolTime === t ? '' : t)}>{t}</button>
              ))}
            </div>
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={addBristol} disabled={!bristolVal}>Log It</button>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }} onClick={() => setBristolOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* HYDRATION — 8oz per glass, 13 glasses, 100oz target */}
      <div className="card card-hydration">
        <div className="section-label">Hydration</div>
        <div className="glass-grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {Array.from({ length: 13 }, (_, i) => (
            <button key={i} className={`glass-btn${i < glassesFilled ? ' filled' : ''}`} onClick={() => handleGlass(i)}>
              {i < glassesFilled ? '💧' : ''}
            </button>
          ))}
        </div>
        <div className={`hydration-info${(Number(log.hydration) || 0) >= 100 ? ' goal' : ''}`}>
          {(Number(log.hydration) || 0) >= 100
            ? `✓ 100oz target hit! (${Number(log.hydration) || 0}oz total)`
            : `${Number(log.hydration) || 0}oz — ${100 - (Number(log.hydration) || 0)} more to 100oz goal`
          }
        </div>
      </div>

      {/* SUPPLEMENTS */}
      <div className="card card-supp">
        <div className="section-label">Supplements</div>
        <div className="supp-row">
          <div className="field-col">
            <label className="field-lbl">AM Stack</label>
            <div className="toggle-grp">
              <button className={`tog${log.amSupp === true ? ' yes' : ''}`} onClick={() => handleSupp('amSupp', true)}>✓ Taken</button>
              <button className={`tog${log.amSupp === false ? ' no' : ''}`} onClick={() => handleSupp('amSupp', false)}>✗ Missed</button>
            </div>
          </div>
          <div className="field-col">
            <label className="field-lbl">PM Stack</label>
            <div className="toggle-grp">
              <button className={`tog${log.pmSupp === true ? ' yes' : ''}`} onClick={() => handleSupp('pmSupp', true)}>✓ Taken</button>
              <button className={`tog${log.pmSupp === false ? ' no' : ''}`} onClick={() => handleSupp('pmSupp', false)}>✗ Missed</button>
            </div>
          </div>
        </div>
      </div>

      {/* WALKING */}
      <div className="card card-walk">
        <div className="section-label">Walking</div>
        <div className="field-row">
          <div className="field-col">
            <label className="field-lbl">Miles</label>
            <input className="input" type="number" step="0.1" placeholder="—" value={log.walkMiles ?? ''} onChange={e => setLogField('walkMiles', e.target.value)} />
          </div>
          <div className="field-col">
            <label className="field-lbl">Duration</label>
            <div className="walk-time-row">
              <input className="input walk-time-input" type="number" min="0" placeholder="0" value={log.walkMins ?? ''} onChange={e => setLogField('walkMins', e.target.value)} />
              <span className="walk-time-sep">m</span>
              <input className="input walk-time-input" type="number" min="0" max="59" placeholder="0" value={log.walkSecs ?? ''} onChange={e => setLogField('walkSecs', e.target.value)} />
              <span className="walk-time-sep">s</span>
            </div>
          </div>
          <div className="field-col">
            <label className="field-lbl">Avg HR</label>
            <input className="input" type="number" placeholder="—" value={log.walkAvgHR ?? ''} onChange={e => setLogField('walkAvgHR', e.target.value)} />
          </div>
        </div>
        {walkHR != null && walkHR > 0 && (() => {
          const zone = getHRZone(walkHR)
          return (
            <div style={{ fontSize: 13, fontWeight: 600, color: zone.color, marginTop: 6 }}>
              {zone.label}
            </div>
          )
        })()}
        {walkTotalSecs > 0 && walkBurnKcal !== null && (
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--sky)', marginTop: 4 }}>
            ~{walkBurnKcal} kcal burned
          </div>
        )}
      </div>

      {/* NOTES */}
      <div className="card card-notes">
        <div className="section-label">Notes</div>
        <textarea className="input" placeholder="GI, energy, food, anything off-pattern…" value={log.notes ?? ''} onChange={e => setLogField('notes', e.target.value)} />
      </div>

      {/* SAVE */}
      <button className="btn-primary" style={{ background: 'var(--green)', boxShadow: '0 4px 12px rgba(26,122,74,0.3)' }} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : isToday ? 'Save Check-in' : `Update ${dateLabel}`}
      </button>

      {showToast && <div className="toast">{isToday ? 'Saved ✓' : 'Updated ✓'}</div>}
    </div>
  )
}
