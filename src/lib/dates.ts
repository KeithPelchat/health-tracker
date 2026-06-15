export function todayChicago(): Date {
  const now = new Date()
  const chicagoStr = now.toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const [month, day, year] = chicagoStr.split('/')
  return new Date(Date.UTC(+year, +month - 1, +day))
}

export function toChicagoDateStr(date?: Date): string {
  const d = date ?? new Date()
  const str = d.toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const [month, day, year] = str.split('/')
  return `${year}-${month}-${day}`
}

export function formatChicagoDisplay(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00Z').toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}
