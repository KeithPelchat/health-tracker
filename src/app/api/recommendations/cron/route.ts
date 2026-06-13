export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { generateRecommendation } from '@/lib/generateRecommendation'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date(); today.setHours(0,0,0,0)
  const existing = await prisma.recommendation.findUnique({ where: { date: today } })
  if (existing) {
    return NextResponse.json({ ok: true, cached: true })
  }

  // Consume stream fully
  const stream = await generateRecommendation()
  const reader = stream.getReader()
  while (true) {
    const { done } = await reader.read()
    if (done) break
  }

  return NextResponse.json({ ok: true, generated: true })
}
