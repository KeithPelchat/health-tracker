export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const body = await req.json()
  const meal = await prisma.meal.update({
    where: { id },
    data: {
      name: body.name,
      category: body.category,
      proteinPer100g: body.proteinPer100g ?? null,
      fatPer100g: body.fatPer100g ?? null,
      carbsPer100g: body.carbsPer100g ?? null,
      calsPer100g: body.calsPer100g ?? null,
      proteinPerUnit: body.proteinPerUnit ?? null,
      fatPerUnit: body.fatPerUnit ?? null,
      carbsPerUnit: body.carbsPerUnit ?? null,
      calsPerUnit: body.calsPerUnit ?? null,
      unitLabel: body.unitLabel ?? null,
      carbsPer100gVeg: body.carbsPer100gVeg ?? null,
      calsPer100gVeg: body.calsPer100gVeg ?? null,
      proteinFixed: body.proteinFixed ?? null,
      fatFixed: body.fatFixed ?? null,
      carbsFixed: body.carbsFixed ?? null,
      calsFixed: body.calsFixed ?? null,
      portionLabel: body.portionLabel ?? null,
    },
  })
  return NextResponse.json({ meal })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  await prisma.meal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
