import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // PROTEIN meals (per 100g cooked weight)
  const proteins = [
    { name: "Chicken breast (cooked)", proteinPer100g: 31, fatPer100g: 3.6, carbsPer100g: 0, calsPer100g: 165 },
    { name: "93/7 Ground beef (cooked, drained)", proteinPer100g: 26, fatPer100g: 13, carbsPer100g: 0, calsPer100g: 218 },
    { name: "Albacore tuna (canned)", proteinPer100g: 25, fatPer100g: 2.5, carbsPer100g: 0, calsPer100g: 128 },
    { name: "Hot sausage blend (70/30 beef/TN Pride, cooked)", proteinPer100g: 21, fatPer100g: 18, carbsPer100g: 0.5, calsPer100g: 248 },
    { name: "Meatloaf (ground beef + pork rind binder, cooked)", proteinPer100g: 20, fatPer100g: 14, carbsPer100g: 1, calsPer100g: 210 },
  ]

  // COUNTABLE meals (per unit)
  const countables = [
    { name: "Egg (large)", unitLabel: "egg", proteinPerUnit: 6, fatPerUnit: 5, carbsPerUnit: 0.4, calsPerUnit: 70 },
    { name: "Rebel Salted Caramel ice cream", unitLabel: "1/2 cup serving", proteinPerUnit: 3, fatPerUnit: 13, carbsPerUnit: 4, calsPerUnit: 150 },
    { name: "Simple Truth Zero Sugar Kombucha", unitLabel: "bottle", proteinPerUnit: 0, fatPerUnit: 0, carbsPerUnit: 1, calsPerUnit: 10 },
    { name: "Standard Coffee (12oz + heavy cream + Whole Earth)", unitLabel: "cup", proteinPerUnit: 1, fatPerUnit: 5, carbsPerUnit: 1, calsPerUnit: 55 },
    { name: "Cottage cheese (Daisy 2%)", unitLabel: "cup", proteinPerUnit: 28, fatPerUnit: 5, carbsPerUnit: 6, calsPerUnit: 180 },
    { name: "Chipotle Double Chicken Bowl (no rice/beans, fajita veggies, guac)", unitLabel: "bowl", proteinPerUnit: 70, fatPerUnit: 22, carbsPerUnit: 14, calsPerUnit: 530 },
  ]

  // VEGETABLE meals (per 100g cooked)
  const vegetables = [
    { name: "Asparagus (cooked)", carbsPer100gVeg: 2, calsPer100gVeg: 20 },
    { name: "Zucchini (cooked)", carbsPer100gVeg: 2, calsPer100gVeg: 17 },
    { name: "Green beans (cooked)", carbsPer100gVeg: 4, calsPer100gVeg: 31 },
    { name: "Spaghetti squash (cooked)", carbsPer100gVeg: 5.5, calsPer100gVeg: 31 },
    { name: "Bell peppers (cooked)", carbsPer100gVeg: 4, calsPer100gVeg: 26 },
    { name: "Baby carrots (raw)", carbsPer100gVeg: 7, calsPer100gVeg: 35 },
  ]

  // CONDIMENT meals (per fixed portion)
  const condiments = [
    { name: "Chosen Foods Avocado Mayo", portionLabel: "1 tbsp", proteinFixed: 0, fatFixed: 10, carbsFixed: 0, calsFixed: 90 },
    { name: "Rao's Marinara Sauce", portionLabel: "1/2 cup", proteinFixed: 2, fatFixed: 3.5, carbsFixed: 6, calsFixed: 80 },
    { name: "Cool Whip Zero Sugar", portionLabel: "2 tbsp", proteinFixed: 0, fatFixed: 1, carbsFixed: 2, calsFixed: 25 },
    { name: "Heavy cream", portionLabel: "1 tbsp", proteinFixed: 0, fatFixed: 5, carbsFixed: 0, calsFixed: 50 },
  ]

  for (const m of proteins) {
    await prisma.meal.upsert({ where: { name: m.name }, update: { ...m, category: 'protein' }, create: { ...m, category: 'protein' } })
  }
  for (const m of countables) {
    await prisma.meal.upsert({ where: { name: m.name }, update: { ...m, category: 'countable' }, create: { ...m, category: 'countable' } })
  }
  for (const m of vegetables) {
    await prisma.meal.upsert({ where: { name: m.name }, update: { ...m, category: 'vegetable' }, create: { ...m, category: 'vegetable' } })
  }
  for (const m of condiments) {
    await prisma.meal.upsert({ where: { name: m.name }, update: { ...m, category: 'condiment' }, create: { ...m, category: 'condiment' } })
  }

  console.log(`Seeded ${proteins.length + countables.length + vegetables.length + condiments.length} meals`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
