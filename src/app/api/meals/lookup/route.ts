export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  try {
    const { description, category, unitLabel, portionLabel } = await req.json()
    if (!description || !category) {
      return NextResponse.json({ error: 'Missing description or category' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    let userMessage: string
    if (category === 'protein') {
      userMessage = `Estimate nutrition per 100g cooked weight for: ${description}\nReturn exactly: {"protein":X,"fat":X,"netCarbs":X,"calories":X}\nUse whole numbers for calories, one decimal for macros.`
    } else if (category === 'countable') {
      userMessage = `Estimate nutrition per single unit of: ${description} (unit: ${unitLabel || 'unit'})\nReturn exactly: {"protein":X,"fat":X,"netCarbs":X,"calories":X}\nUse whole numbers for calories, one decimal for macros.`
    } else if (category === 'vegetable') {
      userMessage = `Estimate net carbs per 100g cooked for: ${description}\nReturn exactly: {"netCarbs":X,"calories":X}\nUse one decimal place.`
    } else if (category === 'condiment') {
      userMessage = `Estimate nutrition per ${portionLabel || 'serving'} of: ${description}\nReturn exactly: {"protein":X,"fat":X,"netCarbs":X,"calories":X}\nUse whole numbers for calories, one decimal for macros.`
    } else {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      system: 'You are a nutrition database. Return ONLY a JSON object with nutrition estimates. No explanation, no markdown, just raw JSON.',
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/```json?\n?|```/g, '').trim()
    const data = JSON.parse(cleaned)

    return NextResponse.json({
      protein: data.protein ?? null,
      fat: data.fat ?? null,
      netCarbs: data.netCarbs ?? null,
      calories: data.calories ?? null,
    })
  } catch (err) {
    console.error('Nutrition lookup error:', err)
    return NextResponse.json({ error: 'Could not look up nutrition' }, { status: 500 })
  }
}
