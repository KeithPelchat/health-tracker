export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  const recs = await prisma.recommendation.findMany({
    orderBy: { date: 'desc' },
    take: 7,
    select: { id: true, date: true, content: true, generatedAt: true },
  })
  return NextResponse.json({ recommendations: recs })
}
