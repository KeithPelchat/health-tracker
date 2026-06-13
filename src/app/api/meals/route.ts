export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  const meals = await prisma.meal.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json({ meals })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const meal = await prisma.meal.create({
    data: {
      name: body.name,
      category: body.category || 'countable',
      isCustom: body.isCustom ?? true,
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
