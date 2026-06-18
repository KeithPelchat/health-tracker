export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const TDEE_HEIGHT_CM = 166.4
const TDEE_BIRTH_YEAR = 1965
const TDEE_BIRTH_MONTH = 1 // January
const TDEE_BIRTH_DAY = 21
const TDEE_FALLBACK_WEIGHT_KG = 99.3 // 219 lbs

function calcAge(now: Date): number {
  const birthDate = new Date(Date.UTC(TDEE_BIRTH_YEAR, TDEE_BIRTH_MONTH - 1, TDEE_BIRTH_DAY))
  let age = now.getFullYear() - birthDate.getFullYear()
  const m = now.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--
  return age
}

function calcTdee(weightLbs: number | null, now: Date): number {
  const weightKg = weightLbs != null ? weightLbs / 2.205 : TDEE_FALLBACK_WEIGHT_KG
  const age = calcAge(now)
  const bmr = (10 * weightKg) + (6.25 * TDEE_HEIGHT_CM) - (5 * age) + 5
  return Math.round(bmr * 1.2)
}

function calcBurn(walkMins: number, weightLbs: number, walkSecs = 0): number {
  const MET = 3.8
  const weightKg = weightLbs / 2.205
  const hours = (walkMins * 60 + walkSecs) / 3600
  return Math.round(MET * weightKg * hours)
}

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get('period') || '7'
  const now = new Date()
  let dateFilter: { gte?: Date } | undefined

  if (period === '7') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    dateFilter = { gte: d }
  } else if (period === '30') {
    const d = new Date(now)
    d.setDate(d.getDate() - 30)
    dateFilter = { gte: d }
  }

  const whereDate = dateFilter ? { date: dateFilter } : {}

  const [dailyLogs, foodGroups, bristolEntries] = await Promise.all([
    prisma.dailyLog.findMany({
      where: whereDate,
      orderBy: { date: 'asc' },
      select: { date: true, weight: true, bpSys: true, bpDia: true, hydration: true, walkMiles: true, walkMins: true, walkSecs: true, walkAvgHR: true, sleepScore: true, sleepHours: true, sleepMins: true, sleepQuality: true },
    }),
    prisma.foodEntry.groupBy({
      by: ['date'],
      _sum: { protein: true, netCarbs: true, fat: true, calories: true },
      where: whereDate,
      orderBy: { date: 'asc' },
    }),
    prisma.bristolEntry.findMany({
      where: whereDate,
      orderBy: { date: 'asc' },
    }),
  ])

  // Weight trend
  const weightTrend = dailyLogs
    .filter(l => l.weight !== null)
    .map(l => ({ date: l.date.toISOString().split('T')[0], weight: l.weight! }))

  // BP trend
  const bpTrend = dailyLogs
    .filter(l => l.bpSys !== null && l.bpDia !== null)
    .map(l => ({ date: l.date.toISOString().split('T')[0], bpSys: l.bpSys!, bpDia: l.bpDia! }))

  // Bristol frequency (all 7 types)
  const bristolFreq = Array.from({ length: 7 }, (_, i) => ({
    type: i + 1,
    count: bristolEntries.filter(b => b.value === i + 1).length,
  }))

  // Macro hit rate
  const daysWithFood = foodGroups.length
  let proteinHitDays = 0
  let carbsHitDays = 0
  for (const fg of foodGroups) {
    if ((fg._sum.protein ?? 0) >= 170) proteinHitDays++
    if ((fg._sum.netCarbs ?? 0) <= 82) carbsHitDays++
  }
  const macroHitRate = {
    proteinPct: daysWithFood > 0 ? Math.round((proteinHitDays / daysWithFood) * 100) : 0,
    carbsPct: daysWithFood > 0 ? Math.round((carbsHitDays / daysWithFood) * 100) : 0,
    daysWithFood,
  }

  // Daily calories
  const dailyCalories = foodGroups.map(fg => ({
    date: (fg.date as Date).toISOString().split('T')[0],
    calories: fg._sum.calories ?? 0,
  }))

  // Hydration trend
  const hydrationData = dailyLogs.filter(l => l.hydration !== null)
  const hydrationTrend = hydrationData.map(l => ({
    date: l.date.toISOString().split('T')[0],
    hydration: l.hydration!,
  }))
  const hydrationAvg = hydrationData.length > 0
    ? Math.round(hydrationData.reduce((s, l) => s + l.hydration!, 0) / hydrationData.length)
    : 0
  const hydrationTargetPct = hydrationData.length > 0
    ? Math.round((hydrationData.filter(l => l.hydration! >= 100).length / hydrationData.length) * 100)
    : 0

  // Walk trend
  const walkData = dailyLogs.filter(l => l.walkMiles !== null)
  const walkTrend = walkData.map(l => ({
    date: l.date.toISOString().split('T')[0],
    walkMiles: l.walkMiles!,
  }))
  const walkTotal = walkData.reduce((s, l) => s + l.walkMiles!, 0)
  const walkCount = walkData.length
  const walkAvg = walkCount > 0 ? Math.round((walkTotal / walkCount) * 10) / 10 : 0

  // Walk HR trend
  const walkHRData = dailyLogs.filter(l => l.walkAvgHR !== null)
  const walkHRTrend = walkHRData.map(l => ({
    date: l.date.toISOString().split('T')[0],
    walkAvgHR: l.walkAvgHR!,
  }))
  const walkHRAvg = walkHRData.length > 0
    ? Math.round(walkHRData.reduce((s, l) => s + l.walkAvgHR!, 0) / walkHRData.length)
    : null

  // Avg weight
  const weightData = dailyLogs.filter(l => l.weight !== null)
  const avgWeight = weightData.length > 0
    ? Math.round((weightData.reduce((s, l) => s + l.weight!, 0) / weightData.length) * 10) / 10
    : null

  // TDEE baseline — use most recent weight available
  const mostRecentWeight = weightData.length > 0 ? weightData[weightData.length - 1].weight : null
  const tdeeBaseline = calcTdee(mostRecentWeight, now)

  // Walk burn - fetch all weight logs ordered desc for "most recent prior weight" lookup
  const allWeightLogs = await prisma.dailyLog.findMany({
    where: { weight: { not: null } },
    orderBy: { date: 'desc' },
    select: { date: true, weight: true },
  })

  const walkBurn: Array<{ date: string; burnKcal: number }> = []
  for (const log of dailyLogs) {
    if (!log.walkMins) continue
    const dateStr = log.date.toISOString().split('T')[0]
    let weightLbs = log.weight
    if (!weightLbs) {
      // Find most recent prior weight
      const prior = allWeightLogs.find(w => w.date <= log.date)
      weightLbs = prior?.weight ?? null
    }
    if (weightLbs) {
      walkBurn.push({ date: dateStr, burnKcal: calcBurn(log.walkMins, weightLbs, log.walkSecs ?? 0) })
    }
  }

  // Sleep trend (all logs in period, even if sleepScore is null)
  const sleepTrend = dailyLogs.map(l => ({
    date: l.date.toISOString().split('T')[0],
    sleepScore: l.sleepScore ?? null,
    sleepQuality: l.sleepQuality ?? null,
    sleepHours: l.sleepHours ?? null,
  }))

  // Sleep stats (only days with sleepQuality set)
  const sleepQualityDays = dailyLogs.filter(l => l.sleepQuality !== null)
  const highCount = sleepQualityDays.filter(l => l.sleepQuality === 'High').length
  const okCount = sleepQualityDays.filter(l => l.sleepQuality === 'OK').length
  const poorCount = sleepQualityDays.filter(l => l.sleepQuality === 'Poor').length
  const totalQualityDays = sleepQualityDays.length

  const sleepScoreDays = dailyLogs.filter(l => l.sleepScore !== null)
  const avgScore = sleepScoreDays.length > 0
    ? Math.round(sleepScoreDays.reduce((s, l) => s + l.sleepScore!, 0) / sleepScoreDays.length)
    : null

  const sleepStats = {
    avgScore,
    highPct: totalQualityDays > 0 ? Math.round((highCount / totalQualityDays) * 100) : 0,
    okPct: totalQualityDays > 0 ? Math.round((okCount / totalQualityDays) * 100) : 0,
    poorPct: totalQualityDays > 0 ? Math.round((poorCount / totalQualityDays) * 100) : 0,
    highCount,
    okCount,
    poorCount,
  }

  // Sleep vs weight correlation
  // For each log with sleepQuality, find the next day's log weight
  const logsByDate: Record<string, typeof dailyLogs[0]> = {}
  for (const l of dailyLogs) {
    logsByDate[l.date.toISOString().split('T')[0]] = l
  }

  const afterHighWeights: number[] = []
  const afterOkPoorWeights: number[] = []

  for (const log of dailyLogs) {
    if (!log.sleepQuality) continue
    const nextDate = new Date(log.date)
    nextDate.setDate(nextDate.getDate() + 1)
    const nextDateStr = nextDate.toISOString().split('T')[0]
    const nextLog = logsByDate[nextDateStr]
    if (!nextLog?.weight) continue
    if (log.sleepQuality === 'High') {
      afterHighWeights.push(nextLog.weight)
    } else {
      afterOkPoorWeights.push(nextLog.weight)
    }
  }

  const sleepWeightCorr = {
    afterHighAvgWeight: afterHighWeights.length > 0
      ? Math.round((afterHighWeights.reduce((s, w) => s + w, 0) / afterHighWeights.length) * 10) / 10
      : null,
    afterOkPoorAvgWeight: afterOkPoorWeights.length > 0
      ? Math.round((afterOkPoorWeights.reduce((s, w) => s + w, 0) / afterOkPoorWeights.length) * 10) / 10
      : null,
  }

  // Build daily calories with walk burn merged
  const walkBurnByDate: Record<string, number> = {}
  for (const wb of walkBurn) {
    walkBurnByDate[wb.date] = wb.burnKcal
  }
  const dailyCaloriesWithBurn = dailyCalories.map(dc => ({
    ...dc,
    burnKcal: walkBurnByDate[dc.date] ?? null,
  }))

  return NextResponse.json({
    weightTrend,
    bpTrend,
    bristolFreq,
    macroHitRate,
    dailyCalories: dailyCaloriesWithBurn,
    hydrationTrend,
    hydrationAvg,
    hydrationTargetPct,
    walkTrend,
    walkTotal: Math.round(walkTotal * 10) / 10,
    walkCount,
    walkAvg,
    walkHRTrend,
    walkHRAvg,
    avgWeight,
    totalDays: dailyLogs.length,
    walkBurn,
    tdeeBaseline,
    sleepTrend,
    sleepStats,
    sleepWeightCorr,
  })
}
