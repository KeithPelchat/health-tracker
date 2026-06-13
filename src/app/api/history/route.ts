export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20')
  const skip = (page - 1) * limit

  const [logs, total] = await Promise.all([
    prisma.dailyLog.findMany({
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.dailyLog.count(),
  ])

  const dates = logs.map(l => l.date)

  const [foodTotals, bristolData] = await Promise.all([
    prisma.foodEntry.groupBy({
      by: ['date'],
      _sum: { protein: true, netCarbs: true, calories: true },
      where: { date: { in: dates } },
    }),
    prisma.bristolEntry.findMany({
      where: { date: { in: dates } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const serializedLogs = logs.map(l => ({
    ...l,
    date: l.date.toISOString().split('T')[0],
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }))

  const serializedFood = foodTotals.map(f => ({
    date: (f.date as Date).toISOString().split('T')[0],
    protein: f._sum.protein ?? 0,
    netCarbs: f._sum.netCarbs ?? 0,
    calories: f._sum.calories ?? 0,
  }))

  const serializedBristol = bristolData.map(b => ({
    ...b,
    date: b.date.toISOString().split('T')[0],
    createdAt: b.createdAt.toISOString(),
  }))

  return NextResponse.json({
    logs: serializedLogs,
    foodTotals: serializedFood,
    bristolData: serializedBristol,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}
