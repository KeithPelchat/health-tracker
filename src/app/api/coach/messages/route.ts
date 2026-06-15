export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ messages: [] })
  const d = new Date(date + 'T00:00:00Z')
  const messages = await prisma.coachMessage.findMany({
    where: { date: d },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ messages })
}

export async function POST(req: NextRequest) {
  const { date, role, content } = await req.json()
  if (!date || !role || !content) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  const d = new Date(date + 'T00:00:00Z')
  const message = await prisma.coachMessage.create({
    data: { date: d, role, content },
  })
  return NextResponse.json({ message })
}
