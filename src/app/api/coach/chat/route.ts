export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import prisma from '@/lib/prisma'
import { buildDataSummary } from '@/lib/generateRecommendation'
import { ensureProtocolContext } from '@/lib/seedProtocol'

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 })
    }

    await ensureProtocolContext()
    const protocolCtx = await prisma.protocolContext.findFirst()
    const dataSummary = await buildDataSummary()

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const systemPrompt = `You are Keith's personal Health Performance Coach for interactive Q&A. You have deep knowledge of his protocol, history, medications, and goals. Answer his specific questions using his actual data.

Keith's complete protocol context:
${protocolCtx?.content ?? ''}

Today's health data:
${dataSummary}

When discussing specific foods not in Keith's meal library, you may reference general nutrition knowledge to give quantity-specific advice tied to his remaining macros for the day.

Guidelines:
- Be direct and conversational — like a knowledgeable friend who knows all his numbers
- Reference actual data when relevant to the question
- Keep responses focused and actionable (aim for 150-300 words unless more detail is truly needed)
- Never recommend anything that conflicts with his cardiac medications (lisinopril, atorvastatin, aspirin 81mg)
- Always consider GI impact first when suggesting foods
- Keep the mid-August physician follow-up (198.8 lb goal) in view
- Keith's BMR baseline (sedentary, BMR×1.2) is approximately 2,000-2,200 kcal depending on current weight. His protocol targets ~1,500-1,600 kcal intake, creating a ~600-700 kcal daily deficit before walk burn. Reference actual calculated values from the data summary when discussing his deficit.`

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const response = await client.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 800,
            system: systemPrompt,
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
          })

          for await (const chunk of response) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(chunk.delta.text))
            }
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err) {
    console.error('Coach chat error:', err)
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 })
  }
}
