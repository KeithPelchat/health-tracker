export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ entries: [] })
  const d = new Date(date + 'T00:00:00')
  const entries = await prisma.bristolEntry.findMany({
    where: { date: d },
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
  const entry = await prisma.bristolEntry.create({
    data: {
      date: d,
      value: Number(body.value),
      timeOfDay: body.timeOfDay ?? null,
    },
  })
  const serialized = {
    ...entry,
    date: entry.date.toISOString().split('T')[0],
    createdAt: entry.createdAt.toISOString(),
  }
  return NextResponse.json({ entry: serialized })
}
