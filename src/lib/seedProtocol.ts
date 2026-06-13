import prisma from './prisma'

const PROTOCOL_CONTENT = `# Keith Pelchat — Health Protocol Context

## WHO KEITH IS
- Software developer, works from home in Murfreesboro, TN
- Male, started protocol late February 2026
- 10+ years post-cholecystectomy (gallbladder removed)
- Cardiac history: LAD blockage
- Daily medications: lisinopril 10mg (BP), atorvastatin 80mg (cholesterol), aspirin 81mg
- Lives alone, third-floor walk-up, small dog requiring 4-5 short potty walks/day
- These potty walks do NOT count as protocol walks

## CURRENT GOALS
- Started ~249 lbs Feb 2026, currently sub-220 lbs (~29+ lbs lost)
- Intermediate goal: under 198.8 lbs by mid-August 2026 physician follow-up
- Primary goal: 175 lbs and <20% body fat by Thanksgiving 2026
- RHR 54-55 bpm is Keith's normal elite baseline — never flag as concerning
- BP target: ~120/70. Diastolic ≤65 is a tripwire (fog/lightheadedness risk)

## PROTOCOL RULES (non-negotiable)
- Protein FLOOR: 170g/day — most important daily target
- Net carb CEILING: 82g/day
- Fat: moderate target ~80-90g/day
- Calories: ~1,500-1,600 kcal landing zone — NOT a hard ceiling
- Hydration FLOOR: 100 oz/day
- Walking TARGET: 3-mile walks (~55-58 min)

## PRIORITY FRAMEWORK
1. GI Stability (Bristol Type 4 target) — always first
2. Fat Loss (sustained deficit)
3. Energy

ACUTE OVERRIDE: diastolic ≤65 OR fog/lightheadedness → pause protocol, immediate sodium + food + rest

## GI MANAGEMENT (critical — no gallbladder)
- Target Bristol Type 4 consistently
- Bristol 1-2: too constipated — increase hydration, gentle movement
- Bristol 6-7: too loose — investigate stress, food trigger, supplement
- Stress is the #1 GI variable — more impactful than food changes
- Fat spikes trigger distress — moderate fat, no fat bombs
- Morning bile reservoir is small — low-fat first meals are smart
- Walking is a confirmed secondary GI motility driver
- Avoid: raw greens, cellulose, high-FODMAP foods, Brussels sprouts

## CARDIOVASCULAR RULES
- Never recommend extended fasting or aggressive restriction
- Lisinopril + aggressive deficit + heat + low sodium can stack dangerously
- Always factor cardiac medications into supplement suggestions
- Diastolic tripwire: if logged ≤65, flag it and recommend sodium + rest

## SUPPLEMENT STACK (active, morning with breakfast)
- D3+K2, Magnesium Glycinate 300mg, Ubiquinol CoQ10 100mg, Fish Oil 1000mg

PERMANENTLY RETIRED (never recommend):
- Nattokinase (interacts with aspirin/cardiac meds)
- MAIA Cacao, Cayenne supplements (GI evidence + med interactions)

RULE: one supplement change at a time, clean observation window

## VALIDATED FOODS
Proteins: chicken breast, 93/7 ground beef (drained), albacore tuna, eggs, cottage cheese (Daisy 2%)
Wins: Chipotle Double Chicken Bowl (no rice/beans, fajita veggies, guac)
Snacks: cottage cheese + Whole Earth + Watkins vanilla, Rebel Salted Caramel ice cream
Drinks: black coffee + heavy cream + Whole Earth sweetener, Simple Truth Zero Sugar Kombucha

## FOODS TO AVOID
- Greek yogurt / Fage: permanently eliminated
- Blueberries: on hold (GI episode — retest pending)
- Rice/starch: rejected (insulin spikes)
- Sparkling water: suboptimal for GI (carbonation)
- Raw greens, high-FODMAP foods

## SLEEP
- Bedtime before 11:30 PM → High sleep score (78-86)
- Bedtime after midnight → OK score (63-74)
- Sleep significantly affects next-day weight and energy

## BEHAVIORAL PATTERNS
- Stress eater — stress bypasses habit system
- Work crunches cause logging lapses and walking lapses
- Stalls are behavioral until proven metabolic — resume execution first
- Does not respond well to yes-man coaching — wants honest reads
- Self-love identity decision early 2026 — sustainable lifestyle, not crash diet

## COACHING STYLE REQUIRED
- Direct, authentic, no fluff or sugarcoating
- Lead with what matters most TODAY based on the data
- Acknowledge what's working before suggesting changes
- Call out protocol drift without softening it
- Always tie recommendations to actual logged numbers
- Never recommend anything conflicting with cardiac medications
- Consider GI impact first when suggesting new foods
- Physician follow-up mid-August 2026 — keep that milestone in view`

export async function ensureProtocolContext() {
  const existing = await prisma.protocolContext.findFirst()
  if (!existing) {
    await prisma.protocolContext.create({ data: { content: PROTOCOL_CONTENT } })
  }
}
