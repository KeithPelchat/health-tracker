export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const BRISTOL_LABELS: Record<number, string> = {
  1: 'Separate hard lumps',
  2: 'Lumpy sausage',
  3: 'Cracked sausage',
  4: 'Smooth sausage',
  5: 'Soft blobs',
  6: 'Fluffy pieces',
  7: 'Watery',
}

function fmtShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtSleepDuration(hours: number | null, mins: number | null): string {
  if (hours == null && mins == null) return ''
  const h = hours ?? 0
  const m = mins ?? 0
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get('range') || '7days'
  const now = new Date()
  let startDate: Date
  let endDate: Date = now

  if (range === 'today') {
    startDate = new Date(now.toISOString().split('T')[0] + 'T00:00:00')
    endDate = startDate
  } else if (range === 'yesterday') {
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    startDate = new Date(y.toISOString().split('T')[0] + 'T00:00:00')
    endDate = startDate
  } else {
    startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 6)
    startDate = new Date(startDate.toISOString().split('T')[0] + 'T00:00:00')
  }

  const dateWhere = range === 'today' || range === 'yesterday'
    ? { date: startDate }
    : { date: { gte: startDate } }

  const [dailyLogs, foodEntries, bristolEntries] = await Promise.all([
    prisma.dailyLog.findMany({ where: dateWhere, orderBy: { date: 'asc' } }),
    prisma.foodEntry.findMany({
      where: range === 'today' || range === 'yesterday'
        ? { date: startDate }
        : { date: { gte: startDate } },
      include: { meal: true },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.bristolEntry.findMany({
      where: dateWhere,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
  ])

  // Group food entries by date
  const foodByDate: Record<string, typeof foodEntries> = {}
  for (const fe of foodEntries) {
    const d = fe.date.toISOString().split('T')[0]
    if (!foodByDate[d]) foodByDate[d] = []
    foodByDate[d].push(fe)
  }

  const bristolByDate: Record<string, typeof bristolEntries> = {}
  for (const be of bristolEntries) {
    const d = be.date.toISOString().split('T')[0]
    if (!bristolByDate[d]) bristolByDate[d] = []
    bristolByDate[d].push(be)
  }

  // BLOCK 1: raw data
  let block1 = '=== HEALTH LOG RAW DATA ===\n\n'
  for (const log of dailyLogs) {
    const dateStr = log.date.toISOString().split('T')[0]
    block1 += `--- ${dateStr} ---\n`
    if (log.weight) block1 += `Weight: ${log.weight} lbs\n`
    if (log.bodyFat) block1 += `Body Fat: ${log.bodyFat}%\n`
    if (log.bpSys && log.bpDia) block1 += `BP: ${log.bpSys}/${log.bpDia}\n`
    if (log.rhr) block1 += `RHR: ${log.rhr} bpm\n`

    // Sleep line
    const hasSleep = log.sleepScore != null || log.sleepHours != null || log.sleepMins != null || log.sleepQuality != null
    if (hasSleep) {
      const scorePart = log.sleepScore != null ? `Score ${log.sleepScore}` : 'Score —'
      const qualityPart = log.sleepQuality ? ` (${log.sleepQuality})` : ''
      const dur = fmtSleepDuration(log.sleepHours ?? null, log.sleepMins ?? null)
      const hoursPart = dur ? ` — ${dur}` : ''
      block1 += `**Sleep:** ${scorePart}${qualityPart}${hoursPart}\n`
    } else {
      block1 += `**Sleep:** —\n`
    }

    block1 += `AM Supps: ${log.amSupp ? 'Yes' : 'No'} | PM Supps: ${log.pmSupp ? 'Yes' : 'No'}\n`
    if (log.hydration != null) block1 += `Hydration: ${log.hydration} oz\n`
    if (log.walkMiles) {
      const wt = log.walkMins != null ? `${log.walkMins}m${log.walkSecs ? `${log.walkSecs}s` : ''}` : ''
      block1 += `Walk: ${log.walkMiles} miles${wt ? ` (${wt})` : ''}\n`
    }

    const foods = foodByDate[dateStr] || []
    if (foods.length > 0) {
      block1 += 'Food:\n'
      const bySlot: Record<string, typeof foods> = {}
      for (const f of foods) {
        if (!bySlot[f.mealSlot]) bySlot[f.mealSlot] = []
        bySlot[f.mealSlot].push(f)
      }
      for (const [slot, items] of Object.entries(bySlot)) {
        block1 += `  [${slot}]\n`
        for (const item of items) {
          const name = item.meal?.name || item.customDesc || 'Custom'
          block1 += `    - ${name}: P${item.protein}g F${item.fat}g C${item.netCarbs}g ${item.calories}kcal\n`
        }
      }
      const totP = foods.reduce((s, f) => s + f.protein, 0)
      const totC = foods.reduce((s, f) => s + f.netCarbs, 0)
      const totF = foods.reduce((s, f) => s + f.fat, 0)
      const totCal = foods.reduce((s, f) => s + f.calories, 0)
      block1 += `  TOTALS: P${Math.round(totP)}g F${Math.round(totF)}g C${Math.round(totC)}g ${totCal}kcal\n`
    }

    const bristols = bristolByDate[dateStr] || []
    if (bristols.length > 0) {
      block1 += 'Bristol:\n'
      for (const b of bristols) {
        block1 += `  Type ${b.value} — ${BRISTOL_LABELS[b.value] || ''}${b.timeOfDay ? ` (${b.timeOfDay})` : ''}\n`
      }
    }

    if (log.notes) block1 += `Notes: ${log.notes}\n`
    block1 += '\n'
  }

  // BLOCK 2: narrative summary
  const loggedDays = dailyLogs.length
  let block2 = '=== NARRATIVE SUMMARY ===\n\n'

  if (loggedDays === 0) {
    block2 += 'No data logged for this period.\n'
  } else {
    block2 += `Period: ${startDate.toISOString().split('T')[0]} — ${dailyLogs[dailyLogs.length - 1].date.toISOString().split('T')[0]}\n`
    block2 += `Days logged: ${loggedDays}\n\n`

    // Weight
    const weightLogs = dailyLogs.filter(l => l.weight)
    if (weightLogs.length >= 2) {
      const delta = (weightLogs[weightLogs.length - 1].weight! - weightLogs[0].weight!).toFixed(1)
      block2 += `Weight: ${weightLogs[0].weight} → ${weightLogs[weightLogs.length - 1].weight} lbs (${Number(delta) > 0 ? '+' : ''}${delta} lbs)\n`
    } else if (weightLogs.length === 1) {
      block2 += `Weight: ${weightLogs[0].weight} lbs (1 reading)\n`
    }

    // Macros
    const daysWithFood = Object.keys(foodByDate).length
    if (daysWithFood > 0) {
      let proteinHits = 0
      let carbHits = 0
      for (const foods of Object.values(foodByDate)) {
        const totP = foods.reduce((s, f) => s + f.protein, 0)
        const totC = foods.reduce((s, f) => s + f.netCarbs, 0)
        if (totP >= 170) proteinHits++
        if (totC <= 82) carbHits++
      }
      block2 += `Protein hit (≥170g): ${proteinHits}/${daysWithFood} days (${Math.round(proteinHits / daysWithFood * 100)}%)\n`
      block2 += `Carbs hit (≤82g): ${carbHits}/${daysWithFood} days (${Math.round(carbHits / daysWithFood * 100)}%)\n`
    }

    // Bristol
    if (bristolEntries.length > 0) {
      const b4Count = bristolEntries.filter(b => b.value === 4).length
      block2 += `Bristol: ${bristolEntries.length} total entries, Type 4 = ${b4Count} (${Math.round(b4Count / bristolEntries.length * 100)}%)\n`
    }

    // Hydration
    const hydLogs = dailyLogs.filter(l => l.hydration != null)
    if (hydLogs.length > 0) {
      const avg = Math.round(hydLogs.reduce((s, l) => s + l.hydration!, 0) / hydLogs.length)
      block2 += `Hydration avg: ${avg} oz/day (target: 100 oz)\n`
    }

    // Walk
    const walkLogs = dailyLogs.filter(l => l.walkMiles)
    if (walkLogs.length > 0) {
      block2 += `Walking: ${walkLogs.length} days logged\n`
    }

    // Sleep summary
    const sleepLogs = dailyLogs.filter(l => l.sleepScore != null)
    if (sleepLogs.length > 0) {
      const avgSleep = Math.round(sleepLogs.reduce((s, l) => s + l.sleepScore!, 0) / sleepLogs.length)
      const qualityLogs = dailyLogs.filter(l => l.sleepQuality != null)
      const highPct = qualityLogs.length > 0
        ? Math.round((qualityLogs.filter(l => l.sleepQuality === 'High').length / qualityLogs.length) * 100)
        : 0
      block2 += `Average sleep score was ${avgSleep}. ${highPct}% of nights were High quality.\n`
    }

    // Notes summary
    const notesLogs = dailyLogs.filter(l => l.notes && l.notes.trim().length > 0)
    if (notesLogs.length > 0) {
      const noteSnippets = notesLogs
        .slice(0, 3)
        .map(l => `${fmtShortDate(l.date)}: '${l.notes!.slice(0, 60)}'`)
        .join(' · ')
      block2 += `Notes: ${noteSnippets}\n`
    }
  }

  const text = block1 + '\n' + block2
  return NextResponse.json({ text })
}
