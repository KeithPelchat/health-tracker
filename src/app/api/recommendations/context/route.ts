export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ensureProtocolContext } from '@/lib/seedProtocol'

export async function GET() {
  await ensureProtocolContext()
  const ctx = await prisma.protocolContext.findFirst()
  return NextResponse.json({ content: ctx?.content ?? '' })
}

export async function PUT(req: NextRequest) {
  const { content } = await req.json()
  const existing = await prisma.protocolContext.findFirst()
  if (existing) {
    await prisma.protocolContext.update({ where: { id: existing.id }, data: { content } })
  } else {
    await prisma.protocolContext.create({ data: { content } })
  }
  return NextResponse.json({ ok: true })
}
