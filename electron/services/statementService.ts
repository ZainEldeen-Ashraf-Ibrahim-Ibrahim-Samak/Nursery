export function getChildStatement(child: any, existingPayments: any[], currentDate: Date) {
  const arabicMonths = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ]

  const regDate = new Date(child.reg_date)
  let startYear = regDate.getFullYear()
  let startMonth = regDate.getMonth()

  if (isNaN(startYear) || isNaN(startMonth)) {
    const now = new Date()
    startYear = now.getFullYear()
    startMonth = now.getMonth()
  }

  const endYear = currentDate.getFullYear()
  const endMonth = currentDate.getMonth()

  const statementMonths: { month: string; year: number }[] = []

  let currY = startYear
  let currM = startMonth

  // If reg date is in the future compared to currentDate, handle gracefully
  if (startYear > endYear || (startYear === endYear && startMonth > endMonth)) {
    statementMonths.push({
      month: arabicMonths[startMonth],
      year: startYear
    })
  } else {
    while (currY < endYear || (currY === endYear && currM <= endMonth)) {
      statementMonths.push({
        month: arabicMonths[currM],
        year: currY
      })
      currM++
      if (currM > 11) {
        currM = 0
        currY++
      }
    }
  }

  const paymentMap = new Map<string, any>()
  for (const p of existingPayments) {
    const key = `${p.year}-${p.month}`
    paymentMap.set(key, p)
  }

  const rows = statementMonths.map(({ month, year }) => {
    const key = `${year}-${month}`
    const existing = paymentMap.get(key)
    if (existing) {
      return {
        month,
        year,
        service: existing.service,
        unit: existing.unit,
        quantity: existing.quantity,
        price: existing.price,
        total: existing.total,
        paid: existing.paid,
        balance: existing.balance,
        status: existing.status,
        notes: existing.notes || ''
      }
    } else {
      return {
        month,
        year,
        service: child.service,
        unit: child.unit,
        quantity: 0,
        price: child.price,
        total: 0,
        paid: 0,
        balance: 0,
        status: 'unpaid' as const,
        notes: ''
      }
    }
  })

  // Sort reverse chronological
  rows.sort((a, b) => {
    if (a.year !== b.year) {
      return b.year - a.year
    }
    const idxA = arabicMonths.indexOf(a.month)
    const idxB = arabicMonths.indexOf(b.month)
    return idxB - idxA
  })

  let totalInvoiced = 0
  let totalCollected = 0
  let totalBalance = 0

  for (const row of rows) {
    totalInvoiced += row.total
    totalCollected += row.paid
    totalBalance += row.balance
  }

  return {
    child: {
      id: child.id,
      name: child.name,
      guardian: child.guardian,
      guardian_phone: child.guardian_phone,
      service: child.service,
      unit: child.unit,
      price: child.price,
      reg_date: child.reg_date,
      is_active: child.is_active
    },
    rows,
    summary: {
      activeMonths: statementMonths.length,
      totalInvoiced: Number(totalInvoiced.toFixed(2)),
      totalCollected: Number(totalCollected.toFixed(2)),
      totalBalance: Number(totalBalance.toFixed(2))
    }
  }
}
