'use client'

import { useEffect, useState } from 'react'

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

const CATEGORIES = ['protein', 'countable', 'vegetable', 'condiment'] as const
type Category = typeof CATEGORIES[number]

const CAT_LABELS: Record<Category, string> = {
  protein: '🥩 Protein',
  countable: '🔢 Countable',
  vegetable: '🥦 Vegetable',
  condiment: '🫙 Condiment',
}

const CAT_DESCS: Record<Category, string> = {
  protein: 'Logged by cooked weight (per 100g)',
  countable: 'Logged by unit count',
  vegetable: 'Net carbs by cooked weight (per 100g)',
  condiment: 'Fixed portion macros',
}

function getMacroSummary(meal: Meal): string {
  switch (meal.category) {
    case 'protein':
      return `P:${meal.proteinPer100g}g  F:${meal.fatPer100g}g  NC:${meal.carbsPer100g}g  ${meal.calsPer100g}kcal — per 100g`
    case 'countable':
      return `P:${meal.proteinPerUnit}g  F:${meal.fatPerUnit}g  NC:${meal.carbsPerUnit}g  ${meal.calsPerUnit}kcal — per ${meal.unitLabel ?? 'unit'}`
    case 'vegetable':
      return `NC:${meal.carbsPer100gVeg}g  ${meal.calsPer100gVeg}kcal — per 100g`
    case 'condiment':
      return `P:${meal.proteinFixed}g  F:${meal.fatFixed}g  NC:${meal.carbsFixed}g  ${meal.calsFixed}kcal — per ${meal.portionLabel ?? 'portion'}`
    default:
      return ''
  }
}

type FormData = Record<string, string>

function emptyForm(): FormData {
  return { name: '', unitLabel: '', portionLabel: '', proteinPer100g: '', fatPer100g: '', carbsPer100g: '', calsPer100g: '', proteinPerUnit: '', fatPerUnit: '', carbsPerUnit: '', calsPerUnit: '', carbsPer100gVeg: '', calsPer100gVeg: '', proteinFixed: '', fatFixed: '', carbsFixed: '', calsFixed: '' }
}

function mealToForm(meal: Meal): FormData {
  return {
    name: meal.name,
    unitLabel: meal.unitLabel ?? '',
    portionLabel: meal.portionLabel ?? '',
    proteinPer100g: String(meal.proteinPer100g ?? ''),
    fatPer100g: String(meal.fatPer100g ?? ''),
    carbsPer100g: String(meal.carbsPer100g ?? ''),
    calsPer100g: String(meal.calsPer100g ?? ''),
    proteinPerUnit: String(meal.proteinPerUnit ?? ''),
    fatPerUnit: String(meal.fatPerUnit ?? ''),
    carbsPerUnit: String(meal.carbsPerUnit ?? ''),
    calsPerUnit: String(meal.calsPerUnit ?? ''),
    carbsPer100gVeg: String(meal.carbsPer100gVeg ?? ''),
    calsPer100gVeg: String(meal.calsPer100gVeg ?? ''),
    proteinFixed: String(meal.proteinFixed ?? ''),
    fatFixed: String(meal.fatFixed ?? ''),
    carbsFixed: String(meal.carbsFixed ?? ''),
    calsFixed: String(meal.calsFixed ?? ''),
  }
}

function formToPayload(form: FormData, category: Category, isCustom = false) {
  const n = (k: string) => form[k] !== '' ? Number(form[k]) : undefined
  const base = { name: form.name.trim(), category, isCustom }
  if (category === 'protein') return { ...base, proteinPer100g: n('proteinPer100g'), fatPer100g: n('fatPer100g'), carbsPer100g: n('carbsPer100g'), calsPer100g: n('calsPer100g') }
  if (category === 'countable') return { ...base, unitLabel: form.unitLabel || undefined, proteinPerUnit: n('proteinPerUnit'), fatPerUnit: n('fatPerUnit'), carbsPerUnit: n('carbsPerUnit'), calsPerUnit: n('calsPerUnit') }
  if (category === 'vegetable') return { ...base, carbsPer100gVeg: n('carbsPer100gVeg'), calsPer100gVeg: n('calsPer100gVeg') }
  if (category === 'condiment') return { ...base, portionLabel: form.portionLabel || undefined, proteinFixed: n('proteinFixed'), fatFixed: n('fatFixed'), carbsFixed: n('carbsFixed'), calsFixed: n('calsFixed') }
  return base
}

function applyLookupToForm(form: FormData, category: Category, res: { protein?: number | null; fat?: number | null; netCarbs?: number | null; calories?: number | null }): FormData {
  const filled = { ...form }
  if (category === 'protein') {
    if (res.protein != null) filled.proteinPer100g = String(res.protein)
    if (res.fat != null) filled.fatPer100g = String(res.fat)
    if (res.netCarbs != null) filled.carbsPer100g = String(res.netCarbs)
    if (res.calories != null) filled.calsPer100g = String(res.calories)
  } else if (category === 'countable') {
    if (res.protein != null) filled.proteinPerUnit = String(res.protein)
    if (res.fat != null) filled.fatPerUnit = String(res.fat)
    if (res.netCarbs != null) filled.carbsPerUnit = String(res.netCarbs)
    if (res.calories != null) filled.calsPerUnit = String(res.calories)
  } else if (category === 'vegetable') {
    if (res.netCarbs != null) filled.carbsPer100gVeg = String(res.netCarbs)
    if (res.calories != null) filled.calsPer100gVeg = String(res.calories)
  } else if (category === 'condiment') {
    if (res.protein != null) filled.proteinFixed = String(res.protein)
    if (res.fat != null) filled.fatFixed = String(res.fat)
    if (res.netCarbs != null) filled.carbsFixed = String(res.netCarbs)
    if (res.calories != null) filled.calsFixed = String(res.calories)
  }
  return filled
}

function CategoryFields({ category, form, onChange }: { category: Category, form: FormData, onChange: (k: string, v: string) => void }) {
  const inp = (label: string, key: string, placeholder?: string) => (
    <div className="field-col">
      <label className="field-lbl">{label}</label>
      <input className="input" type={key === 'unitLabel' || key === 'portionLabel' ? 'text' : 'number'} step="0.1"
        placeholder={placeholder ?? '0'} value={form[key]}
        onChange={e => onChange(key, e.target.value)} />
    </div>
  )
  if (category === 'protein') return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Enter macros per 100g cooked weight.</p>
      <div className="field-row">{inp('Protein / 100g', 'proteinPer100g')}{inp('Fat / 100g', 'fatPer100g')}</div>
      <div className="field-row">{inp('Net Carbs / 100g', 'carbsPer100g')}{inp('Cals / 100g', 'calsPer100g')}</div>
    </>
  )
  if (category === 'countable') return (
    <>
      {inp('Unit label (e.g. "egg", "cup")', 'unitLabel', 'unit')}
      <div style={{ height: 10 }} />
      <div className="field-row">{inp('Protein / unit', 'proteinPerUnit')}{inp('Fat / unit', 'fatPerUnit')}</div>
      <div className="field-row">{inp('Net Carbs / unit', 'carbsPerUnit')}{inp('Cals / unit', 'calsPerUnit')}</div>
    </>
  )
  if (category === 'vegetable') return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Protein and fat negligible for vegetables.</p>
      <div className="field-row">{inp('Net Carbs / 100g', 'carbsPer100gVeg')}{inp('Cals / 100g', 'calsPer100gVeg')}</div>
    </>
  )
  if (category === 'condiment') return (
    <>
      {inp('Portion label (e.g. "1 tbsp")', 'portionLabel', '1 tbsp')}
      <div style={{ height: 10 }} />
      <div className="field-row">{inp('Protein', 'proteinFixed')}{inp('Fat', 'fatFixed')}</div>
      <div className="field-row">{inp('Net Carbs', 'carbsFixed')}{inp('Calories', 'calsFixed')}</div>
    </>
  )
  return null
}

export default function MealsPage() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<FormData>(emptyForm())
  const [editCategory, setEditCategory] = useState<Category>('protein')
  const [editLooking, setEditLooking] = useState(false)
  const [editAutoFilled, setEditAutoFilled] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addCategory, setAddCategory] = useState<Category>('protein')
  const [addForm, setAddForm] = useState<FormData>(emptyForm())
  const [addLooking, setAddLooking] = useState(false)
  const [addAutoFilled, setAddAutoFilled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterCat, setFilterCat] = useState<Category | 'all'>('all')

  async function fetchMeals() {
    const res = await fetch('/api/meals').then(r => r.json())
    setMeals(res.meals || [])
    setLoading(false)
  }

  useEffect(() => { fetchMeals() }, [])

  function startEdit(meal: Meal) {
    setEditingId(meal.id)
    setEditCategory(meal.category as Category)
    setEditForm(mealToForm(meal))
    setEditAutoFilled(false)
  }

  async function handleAddLookup() {
    setAddLooking(true)
    const res = await fetch('/api/meals/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: addForm.name,
        category: addCategory,
        unitLabel: addForm.unitLabel || undefined,
        portionLabel: addForm.portionLabel || undefined,
      }),
    }).then(r => r.json())
    setAddLooking(false)
    if (!res.error) {
      setAddForm(prev => applyLookupToForm(prev, addCategory, res))
      setAddAutoFilled(true)
    }
  }

  async function handleEditLookup() {
    setEditLooking(true)
    const res = await fetch('/api/meals/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: editForm.name,
        category: editCategory,
        unitLabel: editForm.unitLabel || undefined,
        portionLabel: editForm.portionLabel || undefined,
      }),
    }).then(r => r.json())
    setEditLooking(false)
    if (!res.error) {
      setEditForm(prev => applyLookupToForm(prev, editCategory, res))
      setEditAutoFilled(true)
    }
  }

  async function saveEdit(id: number) {
    setSaving(true)
    await fetch(`/api/meals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formToPayload(editForm, editCategory)),
    })
    setSaving(false)
    setEditingId(null)
    setEditAutoFilled(false)
    fetchMeals()
  }

  async function deleteMeal(id: number, name: string) {
    if (!confirm(`Delete "${name}"? Won't affect already-logged entries.`)) return
    await fetch(`/api/meals/${id}`, { method: 'DELETE' })
    fetchMeals()
  }

  async function saveNewMeal() {
    if (!addForm.name.trim()) return
    setSaving(true)
    await fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formToPayload(addForm, addCategory, true)),
    })
    setSaving(false)
    setShowAddForm(false)
    setAddForm(emptyForm())
    setAddAutoFilled(false)
    fetchMeals()
  }

  const displayed = filterCat === 'all' ? meals : meals.filter(m => m.category === filterCat)

  if (loading) return <div className="page"><div className="loading">Loading…</div></div>

  return (
    <div className="page">
      <div className="page-hdr">
        <h1 className="page-title">Meal Library</h1>
        <div className="page-sub">{meals.length} meals saved</div>
        <div className="page-accent" />
      </div>

      {/* Category filter */}
      <div className="period-tabs" style={{ marginBottom: 16 }}>
        {(['all', ...CATEGORIES] as const).map(cat => (
          <button key={cat} className={`period-tab${filterCat === cat ? ' active' : ''}`}
            onClick={() => setFilterCat(cat)}>
            {cat === 'all' ? 'All' : CAT_LABELS[cat as Category].split(' ')[1]}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="section-label">Meals</div>
        {displayed.length === 0 && <div className="empty">No meals in this category.</div>}
        {displayed.map(meal => (
          <div key={meal.id}>
            {editingId === meal.id ? (
              <div className="meal-edit-form">
                <div className="field-col" style={{ marginBottom: 12 }}>
                  <label className="field-lbl">Name</label>
                  <input className="input" value={editForm.name}
                    onChange={e => { setEditForm(p => ({ ...p, name: e.target.value })); setEditAutoFilled(false) }} />
                </div>
                {editForm.name.length >= 3 && (
                  <div style={{ marginBottom: 12 }}>
                    <button
                      className="btn-add-slot"
                      style={{ marginTop: 0 }}
                      onClick={handleEditLookup}
                      disabled={editLooking}
                    >
                      {editLooking ? 'Looking up…' : '🔍 Look up nutrition'}
                    </button>
                    {editAutoFilled && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>
                        ⚠️ AI estimate — verify if precision matters
                      </p>
                    )}
                  </div>
                )}
                <div className="toggle-grp" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat} className={`tog${editCategory === cat ? ' blue' : ''}`}
                      style={{ flex: 'none', padding: '8px 14px', fontSize: 13 }}
                      onClick={() => { setEditCategory(cat); setEditAutoFilled(false) }}>
                      {CAT_LABELS[cat]}
                    </button>
                  ))}
                </div>
                <CategoryFields category={editCategory} form={editForm} onChange={(k, v) => setEditForm(p => ({ ...p, [k]: v }))} />
                <div className="meal-edit-actions">
                  <button className="btn-primary" onClick={() => saveEdit(meal.id)} disabled={saving}>Save Changes</button>
                  <button className="btn-ghost" onClick={() => { setEditingId(null); setEditAutoFilled(false) }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="meal-row">
                <div className="meal-row-info">
                  <div className="meal-row-name">
                    {meal.name}
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--sky)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {meal.category}
                    </span>
                  </div>
                  <div className="meal-row-macros">{getMacroSummary(meal)}</div>
                </div>
                <div className="meal-row-actions">
                  <button className="btn-icon" onClick={() => startEdit(meal)} title="Edit">✏️</button>
                  <button className="btn-icon danger" onClick={() => deleteMeal(meal.id, meal.name)} title="Delete">🗑️</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAddForm ? (
        <div className="card">
          <div className="section-label">New Meal</div>
          <div className="toggle-grp" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} className={`tog${addCategory === cat ? ' blue' : ''}`}
                style={{ flex: 'none', padding: '8px 14px', fontSize: 13 }}
                onClick={() => { setAddCategory(cat); setAddAutoFilled(false) }}>
                {CAT_LABELS[cat]}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>{CAT_DESCS[addCategory]}</p>
          <div className="field-col" style={{ marginBottom: 12 }}>
            <label className="field-lbl">Name</label>
            <input className="input" placeholder="Meal name" value={addForm.name}
              onChange={e => { setAddForm(p => ({ ...p, name: e.target.value })); setAddAutoFilled(false) }} />
          </div>
          {addForm.name.length >= 3 && (
            <div style={{ marginBottom: 12 }}>
              <button
                className="btn-add-slot"
                style={{ marginTop: 0 }}
                onClick={handleAddLookup}
                disabled={addLooking}
              >
                {addLooking ? 'Looking up…' : '🔍 Look up nutrition'}
              </button>
              {addAutoFilled && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>
                  ⚠️ AI estimate — verify if precision matters
                </p>
              )}
            </div>
          )}
          <CategoryFields category={addCategory} form={addForm} onChange={(k, v) => setAddForm(p => ({ ...p, [k]: v }))} />
          <div className="meal-edit-actions">
            <button className="btn-primary" onClick={saveNewMeal} disabled={saving || !addForm.name.trim()}>Save Meal</button>
            <button className="btn-ghost" onClick={() => { setShowAddForm(false); setAddForm(emptyForm()); setAddAutoFilled(false) }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn-add-slot" onClick={() => setShowAddForm(true)}>＋ Add New Meal</button>
      )}
    </div>
  )
}
