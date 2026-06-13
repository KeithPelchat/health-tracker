import prisma from './prisma'
import { ensureProtocolContext } from './seedProtocol'
import Anthropic from '@anthropic-ai/sdk'

function fmtDate(d: Date | string) {
  const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function pct(n: number, d: number) {
  return d === 0 ? '0%' : `${Math.round((n / d) * 100)}%`
}

export async function buildDataSummary(): Promise<string> {
  const now = new Date()
  const since90 = new Date(now); since90.setDate(since90.getDate() - 90); since90.setHours(0,0,0,0)
  const since14 = new Date(now); since14.setDate(since14.getDate() - 14); since14.setHours(0,0,0,0)
  const since7  = new Date(now); since7.setDate(since7.getDate() - 7);   since7.setHours(0,0,0,0)
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0)

  const [logs, bristolEntries, foodEntries, todayLog, todayFood, todayBristol] = await Promise.all([
    prisma.dailyLog.findMany({ where: { date: { gte: since90 } }, orderBy: { date: 'desc' } }),
    prisma.bristolEntry.findMany({ where: { date: { gte: since90 } }, orderBy: { date: 'desc' } }),
    prisma.foodEntry.findMany({
      where: { date: { gte: since90 } },
      include: { meal: { select: { name: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.dailyLog.findFirst({ where: { date: todayStart } }),
    prisma.foodEntry.findMany({ where: { date: todayStart }, include: { meal: { select: { name: true } } } }),
    prisma.bristolEntry.findMany({ where: { date: todayStart } }),
  ])

  const recentLogs = logs.filter(l => l.date >= since14)
  const lines: string[] = []

  lines.push(`## Keith's Health Data — Last ${logs.length > 0 ? Math.ceil((now.getTime() - logs[logs.length-1].date.getTime()) / 86400000) : 0} Days\n`)
  lines.push('### Protocol Targets')
  lines.push('- Protein: ≥170g/day')
  lines.push('- Net Carbs: ≤82g/day')
  lines.push('- Fat: ~80-90g/day')
  lines.push('- Calories: ~1,500-1,600 kcal')
  lines.push('- Hydration: ≥100 oz/day')
  lines.push('- Walking: 3 miles / ~57 min per walk\n')

  // Weight trend (last 14 days)
  lines.push('### Recent Weight Trend')
  const weightLogs = recentLogs.filter(l => l.weight != null)
  if (weightLogs.length === 0) {
    lines.push('No weight data in last 14 days.')
  } else {
    for (const l of weightLogs.slice().reverse()) {
      lines.push(`- ${fmtDate(l.date)} | ${l.weight} lbs${l.bodyFat != null ? ` | ${l.bodyFat}% BF` : ''}`)
    }
    if (weightLogs.length >= 2) {
      const diff = (weightLogs[0].weight! - weightLogs[weightLogs.length-1].weight!).toFixed(1)
      const dir = Number(diff) < 0 ? 'losing' : Number(diff) > 0 ? 'gaining' : 'flat'
      lines.push(`Net change: ${diff} lbs over ${weightLogs.length} days`)
      lines.push(`Trend direction: ${dir}`)
    }
  }
  lines.push('')

  // BP & RHR
  lines.push('### Recent BP & RHR')
  const bpLogs = recentLogs.filter(l => l.bpSys != null || l.rhr != null)
  if (bpLogs.length === 0) {
    lines.push('No BP/RHR data in last 14 days.')
  } else {
    for (const l of bpLogs.slice().reverse()) {
      const bpStr = l.bpSys && l.bpDia ? `BP ${l.bpSys}/${l.bpDia}${l.bpDia <= 65 ? ' WARNING LOW DIASTOLIC' : ''}` : ''
      const rhrStr = l.rhr ? `RHR ${l.rhr}` : ''
      lines.push(`- ${fmtDate(l.date)} | ${[bpStr, rhrStr].filter(Boolean).join(' | ')}`)
    }
  }
  lines.push('')

  // Sleep
  lines.push('### Sleep Summary (last 14 days)')
  const sleepLogs = recentLogs.filter(l => l.sleepScore != null || l.sleepQuality != null)
  if (sleepLogs.length === 0) {
    lines.push('No sleep data in last 14 days.')
  } else {
    const scores = sleepLogs.map(l => l.sleepScore).filter(Boolean) as number[]
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a,b) => a+b,0) / scores.length) : null
    const highNights = sleepLogs.filter(l => l.sleepQuality === 'High').length
    const okNights   = sleepLogs.filter(l => l.sleepQuality === 'OK').length
    const poorNights = sleepLogs.filter(l => l.sleepQuality === 'Poor').length
    if (avgScore) lines.push(`Average score: ${avgScore} | High: ${highNights} nights | OK: ${okNights} nights | Poor: ${poorNights} nights`)
    const last7sleep = sleepLogs.slice(0, 7).reverse()
    for (const l of last7sleep) {
      const dur = l.sleepHours != null ? `${l.sleepHours}h${l.sleepMins ? ` ${l.sleepMins}m` : ''}` : '—'
      lines.push(`- ${fmtDate(l.date)} | Score: ${l.sleepScore ?? '—'} | ${l.sleepQuality ?? '—'} | ${dur}`)
    }
  }
  lines.push('')

  // Bristol
  lines.push('### Bristol Log (last 14 days)')
  const recentBristol = bristolEntries.filter(b => b.date >= since14)
  if (recentBristol.length === 0) {
    lines.push('No Bristol data in last 14 days.')
  } else {
    for (const b of recentBristol.slice().reverse()) {
      lines.push(`- ${fmtDate(b.date)} | Type ${b.value}${b.timeOfDay ? ` | ${b.timeOfDay}` : ''}`)
    }
    const type4 = recentBristol.filter(b => b.value === 4).length
    lines.push(`Type 4 rate: ${pct(type4, recentBristol.length)}`)
    const last7Bristol = bristolEntries.filter(b => b.date >= since7)
    const loose = last7Bristol.filter(b => b.value >= 6)
    lines.push(`Any Type 6-7 in last 7 days: ${loose.length > 0 ? 'Yes — ' + loose.map(b => fmtDate(b.date)).join(', ') : 'No'}`)
  }
  lines.push('')

  // Macro adherence
  lines.push('### Macro Adherence (last 14 days)')
  const foodByDate: Record<string, { protein: number, fat: number, netCarbs: number, calories: number }> = {}
  for (const fe of foodEntries.filter(f => f.date >= since14)) {
    const dk = fe.date.toISOString().split('T')[0]
    if (!foodByDate[dk]) foodByDate[dk] = { protein: 0, fat: 0, netCarbs: 0, calories: 0 }
    foodByDate[dk].protein  += fe.protein
    foodByDate[dk].fat      += fe.fat
    foodByDate[dk].netCarbs += fe.netCarbs
    foodByDate[dk].calories += fe.calories
  }
  const foodDays = Object.values(foodByDate)
  if (foodDays.length === 0) {
    lines.push('No food data in last 14 days.')
  } else {
    const proteinHit = foodDays.filter(d => d.protein >= 170).length
    const carbsHit   = foodDays.filter(d => d.netCarbs <= 82).length
    const avgP  = Math.round(foodDays.reduce((s,d) => s+d.protein, 0) / foodDays.length)
    const avgNC = Math.round(foodDays.reduce((s,d) => s+d.netCarbs, 0) / foodDays.length)
    const avgF  = Math.round(foodDays.reduce((s,d) => s+d.fat, 0) / foodDays.length)
    const avgC  = Math.round(foodDays.reduce((s,d) => s+d.calories, 0) / foodDays.length)
    lines.push(`Protein ≥170g: ${proteinHit} of ${foodDays.length} logged days (${pct(proteinHit, foodDays.length)})`)
    lines.push(`Net carbs ≤82g: ${carbsHit} of ${foodDays.length} logged days (${pct(carbsHit, foodDays.length)})`)
    lines.push(`Avg daily protein: ${avgP}g | Avg daily net carbs: ${avgNC}g | Avg daily fat: ${avgF}g | Avg daily calories: ${avgC} kcal`)
  }
  lines.push('')

  // Hydration
  lines.push('### Hydration (last 14 days)')
  const hydLogs = recentLogs.filter(l => l.hydration != null)
  if (hydLogs.length === 0) {
    lines.push('No hydration data in last 14 days.')
  } else {
    const avg = Math.round(hydLogs.reduce((s,l) => s+l.hydration!, 0) / hydLogs.length)
    const hit = hydLogs.filter(l => l.hydration! >= 100).length
    lines.push(`Average: ${avg} oz/day`)
    lines.push(`Days hitting 100oz target: ${hit} of ${hydLogs.length} (${pct(hit, hydLogs.length)})`)
  }
  lines.push('')

  // Walking
  lines.push('### Walking (last 14 days)')
  const walkLogs = recentLogs.filter(l => l.walkMiles != null || l.walkMins != null)
  if (walkLogs.length === 0) {
    lines.push('No walking data in last 14 days.')
  } else {
    const totalMiles = walkLogs.reduce((s,l) => s+(l.walkMiles??0), 0)
    const avgMiles = totalMiles / walkLogs.length
    const noWalkDays = recentLogs.length - walkLogs.length
    lines.push(`Total walks logged: ${walkLogs.length}`)
    lines.push(`Total miles: ${totalMiles.toFixed(1)}`)
    lines.push(`Avg miles per walk: ${avgMiles.toFixed(1)}`)
    lines.push(`Days with no walk logged: ${noWalkDays}`)
  }
  lines.push('')

  // Recent food log (last 7 days)
  lines.push('### Recent Food Log (last 7 days)')
  const foodLast7 = foodEntries.filter(f => f.date >= since7)
  if (foodLast7.length === 0) {
    lines.push('No food logged in last 7 days.')
  } else {
    const byDay: Record<string, typeof foodLast7> = {}
    for (const fe of foodLast7) {
      const dk = fe.date.toISOString().split('T')[0]
      if (!byDay[dk]) byDay[dk] = []
      byDay[dk].push(fe)
    }
    for (const [dk, entries] of Object.entries(byDay).sort().reverse()) {
      const totalP = Math.round(entries.reduce((s,e) => s+e.protein,0))
      const totalC = Math.round(entries.reduce((s,e) => s+e.calories,0))
      const items = entries.map(e => e.meal?.name || e.customDesc || 'custom').join(', ')
      lines.push(`- ${fmtDate(dk)}: ${items} | P${totalP}g ${totalC}kcal`)
    }
  }
  lines.push('')

  // Supplement adherence
  lines.push('### Supplement Adherence (last 14 days)')
  const amTaken = recentLogs.filter(l => l.amSupp).length
  const pmTaken = recentLogs.filter(l => l.pmSupp).length
  lines.push(`AM taken: ${amTaken} of ${recentLogs.length} days (${pct(amTaken, recentLogs.length)})`)
  lines.push(`PM taken: ${pmTaken} of ${recentLogs.length} days (${pct(pmTaken, recentLogs.length)})`)
  lines.push('')

  // Today's log so far
  lines.push("### Today's Log So Far")
  if (!todayLog && todayFood.length === 0 && todayBristol.length === 0) {
    lines.push('No data logged yet today.')
  } else {
    if (todayLog) {
      if (todayLog.weight)    lines.push(`Weight: ${todayLog.weight} lbs`)
      if (todayLog.bpSys)     lines.push(`BP: ${todayLog.bpSys}/${todayLog.bpDia}${todayLog.bpDia && todayLog.bpDia <= 65 ? ' WARNING LOW DIASTOLIC' : ''}`)
      if (todayLog.rhr)       lines.push(`RHR: ${todayLog.rhr} bpm`)
      if (todayLog.sleepScore) {
        const dur = todayLog.sleepHours != null ? `${todayLog.sleepHours}h${todayLog.sleepMins ? ` ${todayLog.sleepMins}m` : ''}` : '—'
        lines.push(`Sleep: score ${todayLog.sleepScore} | ${todayLog.sleepQuality} | ${dur}`)
      }
      if (todayLog.hydration) lines.push(`Hydration: ${todayLog.hydration} oz`)
      if (todayLog.walkMiles) {
        const wt = todayLog.walkMins != null ? `${todayLog.walkMins}m${todayLog.walkSecs ? `${todayLog.walkSecs}s` : ''}` : ''
        lines.push(`Walk: ${todayLog.walkMiles} mi${wt ? ` / ${wt}` : ''}`)
      }
      if (todayLog.amSupp)    lines.push('AM supplements: taken')
      if (todayLog.pmSupp)    lines.push('PM supplements: taken')
      if (todayLog.notes)     lines.push(`Notes: ${todayLog.notes}`)
    }
    if (todayFood.length > 0) {
      const tp = Math.round(todayFood.reduce((s,e) => s+e.protein,0))
      const tc = Math.round(todayFood.reduce((s,e) => s+e.calories,0))
      const tnc = Math.round(todayFood.reduce((s,e) => s+e.netCarbs,0))
      lines.push(`Food logged: ${todayFood.map(e => e.meal?.name || e.customDesc || 'custom').join(', ')}`)
      lines.push(`Running totals: P${tp}g | NC${tnc}g | ${tc}kcal`)
    }
    if (todayBristol.length > 0) {
      lines.push(`Bristol: ${todayBristol.map(b => `Type ${b.value}`).join(', ')}`)
    }
  }

  return lines.join('\n')
}

export async function generateRecommendation(): Promise<ReadableStream<Uint8Array>> {
  await ensureProtocolContext()
  const protocolCtx = await prisma.protocolContext.findFirst()
  const dataSummary = await buildDataSummary()

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `You are Keith's personal Health Performance Coach. You have deep knowledge of his protocol, history, medications, and goals. Your job is to give him today's daily coaching recommendation based on his actual logged data.

Keith's complete protocol context:
${protocolCtx?.content ?? ''}

Guidelines:
- Be direct and authentic — Keith does not want to be coddled
- Always tie observations to his actual numbers
- Lead with the most important thing for TODAY
- Acknowledge wins before suggesting changes
- Never recommend anything that conflicts with his cardiac medications (lisinopril, atorvastatin, aspirin 81mg)
- Always consider GI impact first when suggesting foods
- Keep the mid-August physician follow-up (198.8 lb goal) in view
- If diastolic was logged ≤65 recently, address it directly`

  const userMessage = `Based on my health data below, give me today's full coaching recommendation.

${dataSummary}

Format your response exactly as:
1. A 3-5 sentence coach paragraph (conversational, direct, data-driven)
2. Then these sections with bullet points:
   **Food Plan**
   **Movement**
   **Hydration**
   **Sleep**
   **Watch List** (anything flagged — low BP, poor sleep streak, GI issues, stalls)
   **What's Working**

Be specific — reference actual numbers from the data. No generic advice.`

  const encoder = new TextEncoder()
  let fullContent = ''

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const response = await client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        })

        for await (const chunk of response) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullContent += chunk.delta.text
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }

        // Save to DB
        const today = new Date(); today.setHours(0,0,0,0)
        await prisma.recommendation.upsert({
          where: { date: today },
          create: { date: today, content: fullContent, dataSnapshot: dataSummary },
          update: { content: fullContent, generatedAt: new Date(), dataSnapshot: dataSummary },
        })

        controller.close()
      } catch (err) {
        controller.error(err)
      }
    }
  })

  return stream
}
