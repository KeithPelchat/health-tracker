export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ entries: [] })
  const d = new Date(date + 'T00:00:00')
  const entries = await prisma.foodEntry.findMany({
    where: { date: d },
    include: { meal: true },
    orderBy: { createdAt: 'asc' },
  })
  const serialized = entries.map(e => ({
    ...e,
    date: e.date.toISOString().split('T')[0],
    createdAt: e.createdAt.toISOString(),
  }))
  return NextResponse.json({ entries: serialized })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const d = new Date(body.date + 'T00:00:00')
  const entry = await prisma.foodEntry.create({
    data: {
      date: d,
      mealSlot: body.mealSlot,
      mealId: body.mealId ?? null,
      customDesc: body.customDesc ?? null,
      protein: Number(body.protein),
      fat: Number(body.fat),
      netCarbs: Number(body.netCarbs),
      calories: Number(body.calories),
    },
    include: { meal: true },
  })
  const serialized = {
    ...entry,
    date: entry.date.toISOString().split('T')[0],
    createdAt: entry.createdAt.toISOString(),
  }
  return NextResponse.json({ entry: serialized })
}
