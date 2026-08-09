import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Card } from '../../components/ui/Card.js'
import { Alert } from '../../components/ui/Alert.js'
import { Input } from '../../components/ui/Input.js'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { friendlyError } from '../../utils/errors.js'

/** The KPI cards that own a drill-down page. Kept in sync with Dashboard.tsx. */
export type BreakdownMetric =
  | 'invoiced'
  | 'collected'
  | 'arrears'
  | 'operational'
  | 'netProfit'
  | 'collectionRate'
  | 'service'

interface ChildLine {
  paymentId: number
  childId: number
  childName: string
  guardian: string
  service: string
  unit: string
  billedQuantity: number
  expectedQuantity: number
  price: number
  proratedRate: number | null
  billedTotal: number
  expectedTotal: number
  paid: number
  outstanding: number
  status: string
  lessonDays: number[]
  notes: string | null
}

interface CollectionLine {
  id: number
  childName: string
  service: string
  amount: number
  method: string
  date: string | null
  notes: string | null
  isLegacy: boolean
}

interface SalaryLine {
  employeeId: number
  name: string
  salaryTypeName: string | null
  salaryTypeMode: string | null
  netSalary: number
  base: number
  payableSessions: number
  totalSessions: number
  bonus: number
  deductions: number
  deductionItems: { reason: string; amount: number }[]
  due: number
  paid: number
  remaining: number
  paidDate: string | null
  hasPayrollRow: boolean
}

interface ExpenseLine {
  id: number
  item: string
  category: string | null
  amount: number
  notes: string | null
  createdAt: string
}

interface BreakdownData {
  month: string
  year: number
  period: { monthIndex: number; daysInMonth: number; isCurrentMonth: boolean; countFromDay: number }
  targetProfitPct: number
  kpis: {
    invoiced: number
    billed: number
    collected: number
    arrears: number
    arrearsBreakdown: { children: number; salaries: number; expenses: number }
    collectionRate: number
    expensesTotal: number
    salariesTotal: number
    salariesDue: number
    netProfit: number
    targetRequired: number
    gap: number
  }
  children: ChildLine[]
  collections: CollectionLine[]
  salaries: SalaryLine[]
  expenses: ExpenseLine[]
  revenueByService: { service: string; collected: number; expected: number; childCount: number }[]
}

const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]
const englishMonths = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const weekdaysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const weekdaysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Small building blocks so every section reads the same way. */
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 space-y-4">
      <div className="text-start">
        <h3 className="font-bold text-slate-800 text-base">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </Card>
  )
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6 text-center text-slate-400 text-sm">{text}</td>
    </tr>
  )
}

/**
 * The equation strip at the top of every page: the card's own number, spelled out as the
 * operands it was computed from. This is the whole point of the page — a KPI you can read
 * back to its inputs without opening the database.
 */
function Formula({
  parts,
  result,
  resultLabel,
}: {
  parts: { label: string; value: string; op?: string }[]
  result: string
  resultLabel: string
}) {
  return (
    <div className="flex flex-wrap items-stretch gap-2 text-start">
      {parts.map((p, idx) => (
        <div key={idx} className="flex items-stretch gap-2">
          {idx > 0 && (
            <span className="self-center text-lg font-bold text-slate-300">{p.op ?? '+'}</span>
          )}
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 min-w-[8rem]">
            <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">{p.label}</div>
            <div className="font-mono font-bold text-slate-800 text-sm mt-0.5">{p.value}</div>
          </div>
        </div>
      ))}
      <span className="self-center text-lg font-bold text-slate-300">=</span>
      <div className="bg-slate-800 rounded-lg px-3 py-2 min-w-[8rem]">
        <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">{resultLabel}</div>
        <div className="font-mono font-extrabold text-white text-sm mt-0.5">{result}</div>
      </div>
    </div>
  )
}

export default function MetricBreakdown() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const navigate = useNavigate()
  const { metric = 'invoiced' } = useParams<{ metric: BreakdownMetric }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')

  const today = new Date()
  const month = searchParams.get('month') || arabicMonths[today.getMonth()]
  const year = Number(searchParams.get('year')) || today.getFullYear()
  /** Only meaningful for the `service` metric — which service row was clicked. */
  const serviceFilter = searchParams.get('service') || ''

  const [data, setData] = useState<BreakdownData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    window.api.dashboard
      .breakdown({ month, year })
      .then((result: BreakdownData) => {
        if (!cancelled) setData(result)
      })
      .catch((err: any) => {
        console.error('Failed to fetch dashboard breakdown:', err)
        if (!cancelled) setError(friendlyError(err, 'Failed to load breakdown'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [month, year])

  const money = (val: number) =>
    new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0,
    }).format(val)

  /** Full precision — the per-line tables must add up to the rounded card figure. */
  const money2 = (val: number) => `${val.toFixed(2)} ${isAr ? 'ج.م' : 'EGP'}`

  const monthLabel = useMemo(() => {
    const idx = arabicMonths.indexOf(month)
    return idx === -1 ? month : isAr ? arabicMonths[idx] : englishMonths[idx]
  }, [month, isAr])

  const titles: Record<string, string> = {
    invoiced: isAr ? 'تفاصيل المستحق على الأسر' : 'Invoiced — line by line',
    collected: isAr ? 'تفاصيل المبالغ المحصلة' : 'Collected — line by line',
    arrears: isAr ? 'تفاصيل الالتزامات المستحقة' : 'Arrears — line by line',
    operational: isAr ? 'تفاصيل المصاريف التشغيلية' : 'Operational cost — line by line',
    netProfit: isAr ? 'تفاصيل صافي الربح' : 'Net profit — line by line',
    collectionRate: isAr ? 'تفاصيل نسبة التحصيل' : 'Collection rate — line by line',
    service: isAr
      ? `تفاصيل إيراد الخدمة${serviceFilter ? `: ${serviceFilter}` : ''}`
      : `Service revenue${serviceFilter ? `: ${serviceFilter}` : ''} — line by line`,
  }

  /**
   * Where a child's expected quantity came from. This is the single most opaque number on the
   * Dashboard: monthly enrollments are always 1, extra lessons are hand-entered, and scheduled
   * services count weekday occurrences — from today onward while the month is still running.
   */
  const quantitySource = (line: ChildLine, period: BreakdownData['period']) => {
    if (line.unit === 'شهر') {
      return isAr ? 'اشتراك شهري — كمية ثابتة = 1' : 'Monthly enrollment — fixed quantity of 1'
    }
    if (line.service === 'حصص إضافية') {
      return isAr
        ? `حصص إضافية مُدخلة يدوياً: ${line.expectedQuantity}`
        : `Extra lessons entered by hand: ${line.expectedQuantity}`
    }
    if (line.lessonDays.length === 0) {
      return isAr
        ? 'لا يوجد جدول أيام محدد — تُستخدم الكمية المسجلة من الحضور'
        : 'No weekday schedule set — the recorded attendance quantity is used'
    }
    const names = line.lessonDays.map((d) => (isAr ? weekdaysAr[d] : weekdaysEn[d])).join(isAr ? '، ' : ', ')
    if (period.isCurrentMonth) {
      const remaining = line.expectedQuantity - line.billedQuantity
      return isAr
        ? `${line.billedQuantity} يوم مسجل بالحضور + ${remaining} يوم مجدول متبقٍ (${names}) من يوم ${period.countFromDay} حتى ${period.daysInMonth}`
        : `${line.billedQuantity} day(s) already attended + ${remaining} scheduled day(s) left (${names}) from day ${period.countFromDay} to ${period.daysInMonth}`
    }
    return isAr
      ? `عدد مرات تكرار الأيام المجدولة (${names}) خلال الشهر كاملاً = ${line.expectedQuantity}`
      : `Occurrences of the scheduled weekdays (${names}) across the full month = ${line.expectedQuantity}`
  }

  /** The literal multiplication behind `expectedTotal`. */
  const priceSource = (line: ChildLine) => {
    if (line.unit === 'شهر' && line.proratedRate != null) {
      return isAr
        ? `${line.expectedQuantity} × ${line.proratedRate.toFixed(2)} (سعر مُجزَّأ لالتحاق في منتصف الشهر بدلاً من ${line.price.toFixed(2)}) = ${line.expectedTotal.toFixed(2)}`
        : `${line.expectedQuantity} × ${line.proratedRate.toFixed(2)} (pro-rated mid-month rate instead of ${line.price.toFixed(2)}) = ${line.expectedTotal.toFixed(2)}`
    }
    return `${line.expectedQuantity} × ${line.price.toFixed(2)} = ${line.expectedTotal.toFixed(2)}`
  }

  /** How an employee's base pay was arrived at, given their salary type's mode. */
  const salarySource = (line: SalaryLine) => {
    const type = line.salaryTypeName ? ` (${line.salaryTypeName})` : ''
    switch (line.salaryTypeMode) {
      case 'fixed_monthly':
        return isAr ? `راتب شهري ثابت${type}` : `Fixed monthly salary${type}`
      case 'per_session_fixed':
        return isAr
          ? `أجر بالحصة${type}: ${line.payableSessions} حصة مستحقة من ${line.totalSessions} مجدولة`
          : `Per-session${type}: ${line.payableSessions} payable of ${line.totalSessions} scheduled`
      case 'per_session_pct':
      case 'per_child_session':
        return isAr
          ? `نسبة من سعر الخدمة${type}: ${line.payableSessions} حصة من سجل مدفوعات المعلمين`
          : `Share of the service price${type}: ${line.payableSessions} session(s) from the teacher payments ledger`
      case 'hybrid':
        return isAr
          ? `راتب أساسي + أجر بالحصة${type}: ${line.payableSessions} حصة مستحقة`
          : `Monthly base + per-session${type}: ${line.payableSessions} payable session(s)`
      default:
        return isAr
          ? `الراتب الصافي المسجل على الموظف${type}`
          : `The employee's recorded net salary${type}`
    }
  }

  const filteredChildren = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.children.filter((c) => {
      if (serviceFilter && c.service !== serviceFilter) return false
      if (q && !c.childName?.toLowerCase().includes(q) && !c.service?.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, search, serviceFilter])

  const filteredCollections = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.collections.filter((c) => {
      if (serviceFilter && c.service !== serviceFilter) return false
      if (q && !c.childName?.toLowerCase().includes(q) && !c.method?.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, search, serviceFilter])

  /** Method totals derived from the same receipt rows the table shows, so the two always agree. */
  const byMethod = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of filteredCollections) {
      map.set(c.method, (map.get(c.method) ?? 0) + c.amount)
    }
    return [...map.entries()]
      .map(([method, total]) => ({ method, total: Number(total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total)
  }, [filteredCollections])

  // Net profit is admin-only on the Dashboard; the drill-down must not be a way around that.
  if (metric === 'netProfit' && !isAdmin) {
    return (
      <div className="p-6">
        <Alert variant="danger" title={t('error')}>
          {isAr ? 'هذه الصفحة متاحة للمسؤولين فقط.' : 'This page is available to administrators only.'}
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-start">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold mb-1 flex items-center gap-1"
          >
            <span>{isAr ? '→' : '←'}</span>
            {isAr ? 'رجوع إلى لوحة التحكم' : 'Back to Dashboard'}
          </button>
          <h1 className="text-2xl font-bold text-slate-900">{titles[metric] ?? metric}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAr
              ? `كل سطر ساهم في هذا الرقم عن ${monthLabel} ${year}، وكيف تم حسابه.`
              : `Every line that makes up this figure for ${monthLabel} ${year}, and how it was computed.`}
          </p>
        </div>
        <div className="w-full md:w-64">
          <Input
            label={isAr ? 'بحث' : 'Search'}
            placeholder={isAr ? 'اسم الطفل أو الخدمة...' : 'Child name or service...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {serviceFilter && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold px-3 py-1.5 rounded-full">
            {isAr ? 'الخدمة:' : 'Service:'} {serviceFilter}
            <button
              onClick={() => {
                searchParams.delete('service')
                setSearchParams(searchParams, { replace: true })
              }}
              className="text-teal-500 hover:text-teal-900"
              aria-label={isAr ? 'إزالة الفلتر' : 'Remove filter'}
            >
              ✕
            </button>
          </span>
        </div>
      )}

      {error && <Alert variant="danger" title={t('error')}>{error}</Alert>}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 border border-slate-200 rounded-xl bg-white/50">
          <LoadingSpinner size="lg" />
          <span className="text-slate-500 font-medium mt-3 text-sm">
            {isAr ? 'جاري تحميل التفاصيل...' : 'Loading breakdown...'}
          </span>
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center h-64 border border-slate-200 rounded-xl bg-white/50 text-slate-400">
          {isAr ? 'لا توجد بيانات للفترة المحددة' : 'No data for the selected period'}
        </div>
      ) : (
        <div className="space-y-6">
          {/* ---- The equation ---- */}
          <Card className="p-5 space-y-3 bg-slate-50/60">
            <h3 className="font-bold text-slate-800 text-base text-start">
              {isAr ? 'كيف تم حساب هذا الرقم' : 'How this figure is computed'}
            </h3>
            {metric === 'invoiced' && (
              <>
                <Formula
                  parts={data.revenueByService.map((s) => ({ label: s.service, value: money(s.expected) }))}
                  result={money(data.kpis.invoiced)}
                  resultLabel={isAr ? 'المستحق' : 'Invoiced'}
                />
                <p className="text-xs text-slate-500 text-start">
                  {isAr
                    ? 'المستحق = مجموع (الكمية المتوقعة × السعر) لكل سطر اشتراك في الشهر. الكمية المتوقعة للخدمات المرتبطة بالحضور تُحسب من أيام الجدول، وللشهر الجاري تُحسب الأيام المتبقية من اليوم الحالي فقط.'
                    : 'Invoiced = the sum of (expected quantity × price) over every enrollment line in the month. For attendance-driven services the expected quantity comes from the weekday schedule; in the current month only days from today onward are added to what has already been attended.'}
                </p>
              </>
            )}
            {(metric === 'collected' || metric === 'service') && (
              <>
                <Formula
                  parts={
                    metric === 'service' && serviceFilter
                      ? [{ label: serviceFilter, value: money(filteredCollections.reduce((s, c) => s + c.amount, 0)) }]
                      : data.revenueByService.map((s) => ({ label: s.service, value: money(s.collected) }))
                  }
                  result={money(
                    metric === 'service' && serviceFilter
                      ? filteredCollections.reduce((s, c) => s + c.amount, 0)
                      : data.kpis.collected
                  )}
                  resultLabel={isAr ? 'المحصل' : 'Collected'}
                />
                <p className="text-xs text-slate-500 text-start">
                  {isAr
                    ? 'المحصل = مجموع إيصالات الدفع المسجلة للشهر. كل قسط يظهر كسطر مستقل بطريقة الدفع وتاريخها؛ المدفوعات القديمة التي لا تحمل أقساطاً تظهر كسطر واحد بقيمة المدفوع.'
                    : 'Collected = the sum of the month\'s recorded receipts. Each installment appears as its own line with its method and date; legacy payments with no installments appear as a single line for the amount paid.'}
                </p>
              </>
            )}
            {metric === 'arrears' && (
              <>
                <Formula
                  parts={[
                    { label: isAr ? 'متأخرات الأطفال' : 'Children', value: money(data.kpis.arrearsBreakdown.children) },
                    { label: isAr ? 'رواتب غير مدفوعة' : 'Unpaid salaries', value: money(data.kpis.arrearsBreakdown.salaries) },
                    { label: isAr ? 'مصروفات الشهر' : 'Month expenses', value: money(data.kpis.arrearsBreakdown.expenses) },
                  ]}
                  result={money(data.kpis.arrears)}
                  resultLabel={isAr ? 'الالتزامات' : 'Arrears'}
                />
                <p className="text-xs text-slate-500 text-start">
                  {isAr
                    ? 'الرقم يخلط ما لم تدفعه الأسر بعد مع ما لم تدفعه الحضانة بعد. متأخرات الأطفال = (المستحق المتوقع − المدفوع) لكل سطر، بحد أدنى صفر. الرواتب غير المدفوعة = (المستحق − المصروف) لكل موظف، بحد أدنى صفر لكل موظف حتى لا يُخفي موظف مدفوع بالزيادة زميلاً لم يُصرف له. المصروفات تُحتسب بالكامل لأن الجدول لا يفرّق بين مدفوع وغير مدفوع.'
                    : 'This figure mixes money owed BY families with money the nursery still owes OUT. Children arrears = (expected total − paid) per line, floored at zero. Unpaid salaries = (due − paid) per employee, floored per employee so an overpaid one cannot mask a colleague who is owed. Expenses count in full because the table has no paid/unpaid split.'}
                </p>
              </>
            )}
            {metric === 'operational' && (
              <>
                <Formula
                  parts={[
                    { label: isAr ? 'رواتب مصروفة' : 'Salaries paid', value: money(data.kpis.salariesTotal) },
                    { label: isAr ? 'نفقات' : 'Expenses', value: money(data.kpis.expensesTotal) },
                  ]}
                  result={money(data.kpis.salariesTotal + data.kpis.expensesTotal)}
                  resultLabel={isAr ? 'المصاريف التشغيلية' : 'Operational cost'}
                />
                <p className="text-xs text-slate-500 text-start">
                  {isAr
                    ? `المصاريف التشغيلية تحتسب الرواتب المصروفة فعلاً (${money(data.kpis.salariesTotal)}) وليس المستحقة (${money(data.kpis.salariesDue)}) — الفرق بينهما هو ما يظهر ضمن الالتزامات المستحقة.`
                    : `Operational cost counts payroll actually paid out (${money(data.kpis.salariesTotal)}), not payroll due (${money(data.kpis.salariesDue)}) — the difference is what shows up under Arrears.`}
                </p>
              </>
            )}
            {metric === 'netProfit' && (
              <>
                <Formula
                  parts={[
                    { label: isAr ? 'المحصل' : 'Collected', value: money(data.kpis.collected) },
                    { label: isAr ? 'رواتب مصروفة' : 'Salaries paid', value: money(data.kpis.salariesTotal), op: '−' },
                    { label: isAr ? 'نفقات' : 'Expenses', value: money(data.kpis.expensesTotal), op: '−' },
                  ]}
                  result={money(data.kpis.netProfit)}
                  resultLabel={isAr ? 'صافي الربح' : 'Net profit'}
                />
                <p className="text-xs text-slate-500 text-start">
                  {isAr
                    ? 'صافي الربح نقدي: يُحسب من المبالغ المحصلة فعلاً وليس من المستحق، ناقص ما صُرف فعلاً من رواتب ونفقات.'
                    : 'Net profit is cash-based: computed from money actually collected (not invoiced), less payroll and expenses actually paid out.'}
                </p>
              </>
            )}
            {metric === 'collectionRate' && (
              <>
                <Formula
                  parts={[
                    { label: isAr ? 'المحصل' : 'Collected', value: money(data.kpis.collected) },
                    { label: isAr ? 'المستحق' : 'Invoiced', value: money(data.kpis.invoiced), op: '÷' },
                  ]}
                  result={`${Math.round(data.kpis.collectionRate * 100)}%`}
                  resultLabel={isAr ? 'نسبة التحصيل' : 'Collection rate'}
                />
                <p className="text-xs text-slate-500 text-start">
                  {isAr
                    ? 'المقام هو المستحق الكامل حتى نهاية الشهر، لا ما تراكم حتى اليوم — لذلك تظل النسبة منخفضة في بداية الشهر بشكل طبيعي.'
                    : 'The denominator is the full month-end invoiced figure, not what has accrued so far — so the rate reads low early in the month by design.'}
                </p>
              </>
            )}
          </Card>

          {/* ---- Children billing lines ---- */}
          {(metric === 'invoiced' || metric === 'arrears' || metric === 'collectionRate' || metric === 'service') && (
            <Section
              title={isAr ? 'سطور الاشتراكات' : 'Enrollment billing lines'}
              subtitle={
                isAr
                  ? 'لكل طفل وخدمة: الكمية ومصدرها، السعر، الإجمالي المتوقع، المدفوع، والمتبقي.'
                  : 'Per child and service: the quantity and where it came from, the rate, the expected total, what was paid, and what remains.'
              }
            >
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2.5 text-start text-xs font-semibold text-slate-500">{isAr ? 'الطفل' : 'Child'}</th>
                      <th className="px-3 py-2.5 text-start text-xs font-semibold text-slate-500">{isAr ? 'الخدمة' : 'Service'}</th>
                      <th className="px-3 py-2.5 text-start text-xs font-semibold text-slate-500">{isAr ? 'كيف حُسبت الكمية' : 'How the quantity was derived'}</th>
                      <th className="px-3 py-2.5 text-start text-xs font-semibold text-slate-500">{isAr ? 'المعادلة' : 'Calculation'}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-semibold text-slate-500">{isAr ? 'المتوقع' : 'Expected'}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-semibold text-slate-500">{isAr ? 'المدفوع' : 'Paid'}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-semibold text-slate-500">{isAr ? 'المتبقي' : 'Outstanding'}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 text-sm align-top">
                    {filteredChildren.length === 0 ? (
                      <EmptyRow colSpan={7} text={isAr ? 'لا توجد سطور مطابقة' : 'No matching lines'} />
                    ) : (
                      filteredChildren.map((line) => (
                        <tr key={line.paymentId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-3 py-2.5 text-start">
                            <Link
                              to={`/children/${line.childId}/statement`}
                              className="font-medium text-slate-800 hover:text-teal-700 hover:underline"
                            >
                              {line.childName}
                            </Link>
                            <div className="text-[10px] text-slate-400">{line.guardian}</div>
                          </td>
                          <td className="px-3 py-2.5 text-start text-slate-700">
                            {line.service}
                            <div className="text-[10px] text-slate-400">{line.unit}</div>
                          </td>
                          <td className="px-3 py-2.5 text-start text-xs text-slate-500 max-w-xs">
                            {quantitySource(line, data.period)}
                          </td>
                          <td className="px-3 py-2.5 text-start text-xs font-mono text-slate-600 whitespace-nowrap">
                            {priceSource(line)}
                          </td>
                          <td className="px-3 py-2.5 text-end font-mono font-semibold text-slate-800 whitespace-nowrap">
                            {money2(line.expectedTotal)}
                          </td>
                          <td className="px-3 py-2.5 text-end font-mono text-teal-700 whitespace-nowrap">
                            {money2(line.paid)}
                          </td>
                          <td className={`px-3 py-2.5 text-end font-mono font-semibold whitespace-nowrap ${line.outstanding > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {money2(line.outstanding)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredChildren.length > 0 && (
                    <tfoot className="bg-slate-50 font-semibold">
                      <tr>
                        <td colSpan={4} className="px-3 py-2.5 text-start text-slate-800">{isAr ? 'الإجمالي' : 'Total'}</td>
                        <td className="px-3 py-2.5 text-end font-mono text-slate-900">
                          {money2(filteredChildren.reduce((s, c) => s + c.expectedTotal, 0))}
                        </td>
                        <td className="px-3 py-2.5 text-end font-mono text-teal-800">
                          {money2(filteredChildren.reduce((s, c) => s + c.paid, 0))}
                        </td>
                        <td className="px-3 py-2.5 text-end font-mono text-rose-700">
                          {money2(filteredChildren.reduce((s, c) => s + c.outstanding, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Section>
          )}

          {/* ---- Receipts ---- */}
          {(metric === 'collected' || metric === 'netProfit' || metric === 'collectionRate' || metric === 'service') && (
            <Section
              title={isAr ? 'إيصالات التحصيل' : 'Collection receipts'}
              subtitle={
                isAr
                  ? 'كل قسط محصل على حدة، بطريقة الدفع وتاريخها.'
                  : 'Every collected installment on its own, with its payment method and date.'
              }
            >
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2.5 text-start text-xs font-semibold text-slate-500">{isAr ? 'الطفل' : 'Child'}</th>
                      <th className="px-3 py-2.5 text-start text-xs font-semibold text-slate-500">{isAr ? 'الخدمة' : 'Service'}</th>
                      <th className="px-3 py-2.5 text-start text-xs font-semibold text-slate-500">{isAr ? 'طريقة الدفع' : 'Method'}</th>
                      <th className="px-3 py-2.5 text-start text-xs font-semibold text-slate-500">{isAr ? 'التاريخ' : 'Date'}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-semibold text-slate-500">{isAr ? 'المبلغ' : 'Amount'}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 text-sm">
                    {filteredCollections.length === 0 ? (
                      <EmptyRow colSpan={5} text={isAr ? 'لا توجد إيصالات' : 'No receipts'} />
                    ) : (
                      filteredCollections.map((c) => (
                        <tr key={`${c.isLegacy ? 'p' : 't'}-${c.id}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-3 py-2.5 text-start font-medium text-slate-800">{c.childName}</td>
                          <td className="px-3 py-2.5 text-start text-slate-700">{c.service}</td>
                          <td className="px-3 py-2.5 text-start text-slate-700">
                            {c.method}
                            {c.isLegacy && (
                              <span className="ms-1.5 text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded">
                                {isAr ? 'دفعة مجمعة' : 'aggregate'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-start text-slate-500 text-xs">{c.date?.slice(0, 10) ?? '—'}</td>
                          <td className="px-3 py-2.5 text-end font-mono font-semibold text-teal-700 whitespace-nowrap">{money2(c.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredCollections.length > 0 && (
                    <tfoot className="bg-slate-50 font-semibold">
                      <tr>
                        <td colSpan={4} className="px-3 py-2.5 text-start text-slate-800">{isAr ? 'الإجمالي' : 'Total'}</td>
                        <td className="px-3 py-2.5 text-end font-mono text-teal-800">
                          {money2(filteredCollections.reduce((s, c) => s + c.amount, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Section>
          )}

          {/* ---- Collected grouped by payment method ---- */}
          {(metric === 'collected' || metric === 'service') && (
            <Section
              title={isAr ? 'التحصيل حسب طريقة الدفع' : 'Collected by payment method'}
              subtitle={isAr ? 'نفس الإيصالات أعلاه، مجمّعة حسب الطريقة.' : 'The same receipts above, grouped by method.'}
            >
              <div className="divide-y divide-slate-100">
                {byMethod.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">
                    {isAr ? 'لا توجد مدفوعات محصّلة لهذا الشهر.' : 'No collected payments this month.'}
                  </p>
                ) : (
                  <>
                    {byMethod.map((m) => (
                      <div key={m.method} className="flex justify-between items-center py-2.5">
                        <span className="text-sm text-slate-700">{m.method}</span>
                        <span className="font-mono font-bold text-teal-700">{money2(m.total)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center py-2.5 border-t-2 border-slate-200">
                      <span className="text-sm font-semibold text-slate-800">{isAr ? 'الإجمالي' : 'Total'}</span>
                      <span className="font-mono font-extrabold text-teal-800">
                        {money2(byMethod.reduce((s, m) => s + m.total, 0))}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </Section>
          )}

          {/* ---- Payroll ---- */}
          {(metric === 'operational' || metric === 'arrears' || metric === 'netProfit') && (
            <Section
              title={isAr ? 'الرواتب' : 'Payroll'}
              subtitle={
                isAr
                  ? 'لكل موظف: كيف حُسب الأساس حسب نوع الراتب، ثم المكافأة والخصومات والمصروف فعلاً.'
                  : 'Per employee: how the base was derived from their salary type, then bonus, deductions, and what was actually paid.'
              }
            >
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2.5 text-start text-xs font-semibold text-slate-500">{isAr ? 'الموظف' : 'Employee'}</th>
                      <th className="px-3 py-2.5 text-start text-xs font-semibold text-slate-500">{isAr ? 'كيف حُسب الأساس' : 'How the base was derived'}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-semibold text-slate-500">{isAr ? 'الأساس' : 'Base'}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-semibold text-slate-500">{isAr ? 'مكافأة' : 'Bonus'}</th>
                      <th className="px-3 py-2.5 text-start text-xs font-semibold text-slate-500">{isAr ? 'خصومات' : 'Deductions'}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-semibold text-slate-500">{isAr ? 'المستحق' : 'Due'}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-semibold text-slate-500">{isAr ? 'المصروف' : 'Paid'}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-semibold text-slate-500">{isAr ? 'المتبقي' : 'Remaining'}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 text-sm align-top">
                    {data.salaries.length === 0 ? (
                      <EmptyRow colSpan={8} text={isAr ? 'لا يوجد موظفون' : 'No employees'} />
                    ) : (
                      data.salaries.map((s) => (
                        <tr key={s.employeeId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-3 py-2.5 text-start font-medium text-slate-800">
                            {s.name}
                            {!s.hasPayrollRow && (
                              <div className="text-[10px] text-rose-500">
                                {isAr ? 'لم يُسجَّل صرف بعد' : 'no payroll recorded yet'}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-start text-xs text-slate-500 max-w-xs">{salarySource(s)}</td>
                          <td className="px-3 py-2.5 text-end font-mono text-slate-800 whitespace-nowrap">{money2(s.base)}</td>
                          <td className="px-3 py-2.5 text-end font-mono text-slate-600 whitespace-nowrap">{money2(s.bonus)}</td>
                          <td className="px-3 py-2.5 text-start text-xs text-slate-600">
                            {s.deductionItems.length === 0 ? (
                              <span className="text-slate-300">—</span>
                            ) : (
                              s.deductionItems.map((d, idx) => (
                                <div key={idx} className="flex justify-between gap-2 whitespace-nowrap">
                                  <span>{d.reason}</span>
                                  <span className="font-mono text-rose-600">−{d.amount.toFixed(2)}</span>
                                </div>
                              ))
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-end font-mono font-semibold text-slate-900 whitespace-nowrap">{money2(s.due)}</td>
                          <td className="px-3 py-2.5 text-end font-mono text-teal-700 whitespace-nowrap">{money2(s.paid)}</td>
                          <td className={`px-3 py-2.5 text-end font-mono font-semibold whitespace-nowrap ${s.remaining > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {money2(s.remaining)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data.salaries.length > 0 && (
                    <tfoot className="bg-slate-50 font-semibold">
                      <tr>
                        <td colSpan={5} className="px-3 py-2.5 text-start text-slate-800">{isAr ? 'الإجمالي' : 'Total'}</td>
                        <td className="px-3 py-2.5 text-end font-mono text-slate-900">{money2(data.kpis.salariesDue)}</td>
                        <td className="px-3 py-2.5 text-end font-mono text-teal-800">{money2(data.kpis.salariesTotal)}</td>
                        <td className="px-3 py-2.5 text-end font-mono text-rose-700">{money2(data.kpis.arrearsBreakdown.salaries)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Section>
          )}

          {/* ---- Expenses ---- */}
          {(metric === 'operational' || metric === 'arrears' || metric === 'netProfit') && (
            <Section
              title={isAr ? 'النفقات' : 'Expenses'}
              subtitle={isAr ? 'كل بند نفقة مسجل على هذا الشهر.' : 'Every expense item recorded against this month.'}
            >
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2.5 text-start text-xs font-semibold text-slate-500">{isAr ? 'البند' : 'Item'}</th>
                      <th className="px-3 py-2.5 text-start text-xs font-semibold text-slate-500">{isAr ? 'التصنيف' : 'Category'}</th>
                      <th className="px-3 py-2.5 text-start text-xs font-semibold text-slate-500">{isAr ? 'ملاحظات' : 'Notes'}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-semibold text-slate-500">{isAr ? 'المبلغ' : 'Amount'}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 text-sm">
                    {data.expenses.length === 0 ? (
                      <EmptyRow colSpan={4} text={isAr ? 'لا توجد نفقات لهذا الشهر' : 'No expenses this month'} />
                    ) : (
                      data.expenses.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-3 py-2.5 text-start font-medium text-slate-800">{e.item}</td>
                          <td className="px-3 py-2.5 text-start text-slate-600">{e.category || '—'}</td>
                          <td className="px-3 py-2.5 text-start text-xs text-slate-500">{e.notes || '—'}</td>
                          <td className="px-3 py-2.5 text-end font-mono font-semibold text-slate-800 whitespace-nowrap">{money2(e.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {data.expenses.length > 0 && (
                    <tfoot className="bg-slate-50 font-semibold">
                      <tr>
                        <td colSpan={3} className="px-3 py-2.5 text-start text-slate-800">{isAr ? 'الإجمالي' : 'Total'}</td>
                        <td className="px-3 py-2.5 text-end font-mono text-slate-900">{money2(data.kpis.expensesTotal)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Section>
          )}

          {/* ---- Service split (entry point into the per-service view) ---- */}
          {(metric === 'service' || metric === 'collected' || metric === 'invoiced') && !serviceFilter && (
            <Section
              title={isAr ? 'التوزيع حسب الخدمة' : 'Split by service'}
              subtitle={isAr ? 'اضغط على خدمة لعرض سطورها وحدها.' : 'Click a service to see only its lines.'}
            >
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2.5 text-start text-xs font-semibold text-slate-500">{isAr ? 'الخدمة' : 'Service'}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-semibold text-slate-500">{isAr ? 'عدد السطور' : 'Lines'}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-semibold text-slate-500">{isAr ? 'المتوقع' : 'Expected'}</th>
                      <th className="px-3 py-2.5 text-end text-xs font-semibold text-slate-500">{isAr ? 'المحصل' : 'Collected'}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 text-sm">
                    {data.revenueByService.length === 0 ? (
                      <EmptyRow colSpan={4} text={isAr ? 'لا توجد خدمات' : 'No services'} />
                    ) : (
                      data.revenueByService.map((s) => (
                        <tr
                          key={s.service}
                          onClick={() => navigate(`/breakdown/service?month=${encodeURIComponent(month)}&year=${year}&service=${encodeURIComponent(s.service)}`)}
                          className="hover:bg-teal-50/40 cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-2.5 text-start font-medium text-slate-800">{s.service}</td>
                          <td className="px-3 py-2.5 text-end font-mono text-slate-600">{s.childCount}</td>
                          <td className="px-3 py-2.5 text-end font-mono text-slate-800 whitespace-nowrap">{money2(s.expected)}</td>
                          <td className="px-3 py-2.5 text-end font-mono font-semibold text-teal-700 whitespace-nowrap">{money2(s.collected)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  )
}
