export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ log: null })
  const d = new Date(date + 'T00:00:00')
  const log = await prisma.dailyLog.findUnique({ where: { date: d } })

  // Most recent weight from any DailyLog
  const recentWeightLog = await prisma.dailyLog.findFirst({
    where: { weight: { not: null } },
    orderBy: { date: 'desc' },
    select: { weight: true }
  })

  return NextResponse.json({ log, recentWeight: recentWeightLog?.weight ?? null })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { date, ...fields } = body
  const d = new Date(date + 'T00:00:00')
  const log = await prisma.dailyLog.upsert({
    where: { date: d },
    update: {
      weight: fields.weight !== undefined ? Number(fields.weight) || null : undefined,
      bodyFat: fields.bodyFat !== undefined ? Number(fields.bodyFat) || null : undefined,
      bpSys: fields.bpSys !== undefined ? Number(fields.bpSys) || null : undefined,
      bpDia: fields.bpDia !== undefined ? Number(fields.bpDia) || null : undefined,
      rhr: fields.rhr !== undefined ? Number(fields.rhr) || null : undefined,
      sleepScore: fields.sleepScore !== undefined ? (fields.sleepScore !== null ? Number(fields.sleepScore) : null) : undefined,
      sleepHours: fields.sleepHours !== undefined ? (fields.sleepHours !== null ? Number(fields.sleepHours) : null) : undefined,
      sleepMins:  fields.sleepMins  !== undefined ? (fields.sleepMins  !== null ? Number(fields.sleepMins)  : null) : undefined,
      sleepQuality: fields.sleepQuality !== undefined ? fields.sleepQuality || null : undefined,
      amSupp: fields.amSupp !== undefined ? (fields.amSupp === null ? null : Boolean(fields.amSupp)) : undefined,
      pmSupp: fields.pmSupp !== undefined ? (fields.pmSupp === null ? null : Boolean(fields.pmSupp)) : undefined,
      hydration: fields.hydration !== undefined ? Number(fields.hydration) || null : undefined,
      walkMiles: fields.walkMiles !== undefined ? Number(fields.walkMiles) || null : undefined,
      walkMins: fields.walkMins !== undefined ? Number(fields.walkMins) || null : undefined,
      walkSecs: fields.walkSecs !== undefined ? Number(fields.walkSecs) || null : undefined,
      walkAvgHR: fields.walkAvgHR !== undefined ? Number(fields.walkAvgHR) || null : undefined,
      notes: fields.notes !== undefined ? fields.notes || null : undefined,
    },
    create: {
      date: d,
      weight: fields.weight ? Number(fields.weight) : null,
      bodyFat: fields.bodyFat ? Number(fields.bodyFat) : null,
      bpSys: fields.bpSys ? Number(fields.bpSys) : null,
      bpDia: fields.bpDia ? Number(fields.bpDia) : null,
      rhr: fields.rhr ? Number(fields.rhr) : null,
      sleepScore: fields.sleepScore !== null && fields.sleepScore !== undefined ? Number(fields.sleepScore) : null,
      sleepHours: fields.sleepHours !== null && fields.sleepHours !== undefined ? Number(fields.sleepHours) : null,
      sleepMins:  fields.sleepMins  !== null && fields.sleepMins  !== undefined ? Number(fields.sleepMins)  : null,
      sleepQuality: fields.sleepQuality || null,
      amSupp: fields.amSupp !== undefined ? (fields.amSupp === null ? null : Boolean(fields.amSupp)) : null,
      pmSupp: fields.pmSupp !== undefined ? (fields.pmSupp === null ? null : Boolean(fields.pmSupp)) : null,
      hydration: fields.hydration ? Number(fields.hydration) : null,
      walkMiles: fields.walkMiles ? Number(fields.walkMiles) : null,
      walkMins: fields.walkMins ? Number(fields.walkMins) : null,
      walkSecs: fields.walkSecs ? Number(fields.walkSecs) : null,
      walkAvgHR: fields.walkAvgHR ? Number(fields.walkAvgHR) : null,
      notes: fields.notes || null,
    },
  })
  return NextResponse.json({ log })
}
