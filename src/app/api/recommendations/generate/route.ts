export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { generateRecommendation } from '@/lib/generateRecommendation'

export async function POST() {
  try {
    const stream = await generateRecommendation()
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err) {
    console.error('Generate error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
