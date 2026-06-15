export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { todayChicago } from '@/lib/dates'

export async function GET() {
  const today = todayChicago()

  const rec = await prisma.recommendation.findUnique({
    where: { date: today },
  })

  if (!rec) return NextResponse.json({ content: null })

  return NextResponse.json({
    content: rec.content,
    generatedAt: rec.generatedAt,
    dataSnapshot: rec.dataSnapshot,
  })
}
