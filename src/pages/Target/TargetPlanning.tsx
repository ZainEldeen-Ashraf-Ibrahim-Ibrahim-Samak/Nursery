import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '../../components/ui/Card.js'
import { Stat } from '../../components/ui/Stat.js'
import { Button } from '../../components/ui/Button.js'
import { Alert } from '../../components/ui/Alert.js'
import { Input } from '../../components/ui/Input.js'
import { Select } from '../../components/ui/Select.js'
import { Badge } from '../../components/ui/Badge.js'

interface MonthRow {
  month: string
  collected: number
  expenses: number
  salaries: number
  totalExpenses: number
  targetRequired: number
  gap: number
  coveragePct: number
  status: 'met' | 'missed'
}

interface TargetData {
  rows: MonthRow[]
  targetProfitPct: number
  annualCollected: number
  annualExpenses: number
  annualTargetRequired: number
  annualGap: number
}

interface CalcResult {
  projectedRevenue: number
  targetRequired: number
  coveragePct: number
  unitsNeeded: Record<string, number>
  pricing: Record<string, number>
}

const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

const englishMonths = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const yearsList = [2024, 2025, 2026, 2027, 2028, 2029, 2030]

export default function TargetPlanning() {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TargetData | null>(null)

  // Calculator state (T074)
  const [calcMonth, setCalcMonth] = useState(arabicMonths[new Date().getMonth()])
  const [calcCounts, setCalcCounts] = useState<Record<string, string>>({
    حضانة: '10',
    استضافة: '5',
    جلسة: '20'
  })
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null)
  const [isCalcing, setIsCalcing] = useState(false)
  // Feature 004 — Target Profit % is a calculator input (FR-014). Empty = use
  // the saved setting (so outputs are unchanged when left untouched, FR-015).
  const [calcProfitPct, setCalcProfitPct] = useState('')

  const fetchTarget = async (year: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.api.target.get({ year })
      setData(result)
      // Prefill the calculator's Target Profit % from the saved setting (once).
      setCalcProfitPct((prev) =>
        prev.trim() === '' && result?.targetProfitPct != null
          ? String(Math.round(result.targetProfitPct * 100))
          : prev
      )
    } catch (err: any) {
      let msg = err.message || 'Failed to fetch target data'
      if (msg.includes('Error invoking remote method')) {
        msg = msg.replace(/^Error: Error invoking remote method '[^']+': /, '')
      }
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTarget(currentYear)
  }, [currentYear])

  const handleCalc = async () => {
    setIsCalcing(true)
    try {
      const distribution: Record<string, number> = {}
      for (const [service, val] of Object.entries(calcCounts)) {
        const n = Number(val)
        if (!isNaN(n) && n > 0) distribution[service] = n
      }

      const result = await window.api.target.calc({
        distribution,
        month: calcMonth,
        year: currentYear,
        // Convert percentage points → fraction; omit when blank to use the saved setting.
        targetProfitPct: calcProfitPct.trim() === '' ? undefined : Number(calcProfitPct) / 100
      })
      setCalcResult(result)
    } catch (err: any) {
      let msg = err.message || 'Calculation failed'
      if (msg.includes('Error invoking remote method')) {
        msg = msg.replace(/^Error: Error invoking remote method '[^']+': /, '')
      }
      setError(msg)
    } finally {
      setIsCalcing(false)
    }
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0
    }).format(n)

  const formatPct = (n: number) => `${Math.round(n * 100)}%`

  const yearOptions = useMemo(() =>
    yearsList.map((y) => ({ value: y, label: y.toString() })),
    []
  )

  const monthOptions = useMemo(() =>
    arabicMonths.map((m, idx) => ({
      value: m,
      label: isAr ? m : englishMonths[idx]
    })),
    [isAr]
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isAr ? 'تخطيط الأهداف المالية' : 'Financial Target Planning'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAr
              ? 'تحليل الأهداف الشهرية مقارنة بالمصروفات والتحصيل الفعلي مع حاسبة توزيع الخدمات.'
              : 'Monthly target analysis vs. expenses and actual collection, with a service distribution calculator.'}
          </p>
        </div>
        <Select
          label={isAr ? 'السنة' : 'Year'}
          value={currentYear.toString()}
          options={yearOptions}
          onChange={(e) => setCurrentYear(Number(e.target.value))}
        />
      </div>

      {error && (
        <Alert variant="danger" title={isAr ? 'خطأ' : 'Error'} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Annual Summary KPIs */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Stat
            title={isAr ? 'إجمالي المحصّل سنوياً' : 'Annual Collected'}
            value={formatCurrency(data.annualCollected)}
            icon="💵"
          />
          <Stat
            title={isAr ? 'إجمالي المصروفات سنوياً' : 'Annual Expenses'}
            value={formatCurrency(data.annualExpenses)}
            icon="💸"
          />
          <Stat
            title={isAr ? 'إجمالي الهدف المطلوب' : 'Annual Target Required'}
            value={formatCurrency(data.annualTargetRequired)}
            icon="🎯"
            description={`${formatPct(data.targetProfitPct)} ${isAr ? 'هامش ربح مستهدف' : 'target profit margin'}`}
          />
          <Stat
            title={isAr ? 'إجمالي الفجوة السنوية' : 'Annual Gap'}
            value={formatCurrency(data.annualGap)}
            icon={data.annualGap === 0 ? '✅' : '⚠️'}
            description={data.annualGap === 0
              ? (isAr ? 'تم تحقيق الهدف' : 'Target achieved')
              : (isAr ? 'لم يتحقق الهدف' : 'Target not met')}
          />
        </div>
      )}

      {/* 12-Month Table */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">
            🎯 {isAr ? `تفاصيل الأهداف الشهرية لعام ${currentYear}` : `Monthly Targets for ${currentYear}`}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-start font-semibold text-slate-600">{isAr ? 'الشهر' : 'Month'}</th>
                <th className="px-4 py-3 text-end font-semibold text-slate-600">{isAr ? 'المصروفات' : 'Expenses'}</th>
                <th className="px-4 py-3 text-end font-semibold text-slate-600">{isAr ? 'الرواتب' : 'Salaries'}</th>
                <th className="px-4 py-3 text-end font-semibold text-slate-600">{isAr ? 'إجمالي التكاليف' : 'Total Costs'}</th>
                <th className="px-4 py-3 text-end font-semibold text-slate-600">{isAr ? 'الهدف المطلوب' : 'Target Required'}</th>
                <th className="px-4 py-3 text-end font-semibold text-slate-600">{isAr ? 'المحصّل' : 'Collected'}</th>
                <th className="px-4 py-3 text-end font-semibold text-slate-600">{isAr ? 'الفجوة' : 'Gap'}</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-600">{isAr ? 'التغطية' : 'Coverage'}</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-600">{isAr ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    {isAr ? 'جاري التحميل...' : 'Loading...'}
                  </td>
                </tr>
              ) : data ? (
                data.rows.map((row, idx) => (
                  <tr
                    key={row.month}
                    className={`border-b border-slate-100 hover:bg-slate-50/70 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {isAr ? row.month : englishMonths[arabicMonths.indexOf(row.month)]}
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-sm text-slate-600">
                      {row.expenses > 0 ? formatCurrency(row.expenses) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-sm text-slate-600">
                      {row.salaries > 0 ? formatCurrency(row.salaries) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-sm font-bold text-slate-700">
                      {row.totalExpenses > 0 ? formatCurrency(row.totalExpenses) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-sm text-amber-700 font-semibold">
                      {row.targetRequired > 0 ? formatCurrency(row.targetRequired) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-sm text-emerald-700 font-semibold">
                      {row.collected > 0 ? formatCurrency(row.collected) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-sm">
                      {row.gap > 0 ? (
                        <span className="text-red-600 font-semibold">{formatCurrency(row.gap)}</span>
                      ) : (
                        <span className="text-emerald-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.totalExpenses > 0 ? (
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-20 bg-slate-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${row.status === 'met' ? 'bg-emerald-500' : 'bg-amber-400'}`}
                              style={{ width: `${Math.min(100, Math.round(row.coveragePct * 100))}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-slate-500">
                            {formatPct(row.coveragePct)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.totalExpenses > 0 ? (
                        <Badge variant={row.status === 'met' ? 'success' : 'warning'}>
                          {row.status === 'met'
                            ? (isAr ? '✅ محقق' : '✅ Met')
                            : (isAr ? '⚠️ لم يتحقق' : '⚠️ Missed')}
                        </Badge>
                      ) : (
                        <span className="text-slate-300 text-xs">{isAr ? 'لا بيانات' : 'No data'}</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    {isAr ? 'لا توجد بيانات' : 'No data available'}
                  </td>
                </tr>
              )}
            </tbody>
            {data && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300">
                  <td className="px-4 py-3 font-bold text-slate-700">{isAr ? 'الإجمالي' : 'Total'}</td>
                  <td className="px-4 py-3 text-end font-mono font-bold text-slate-700">
                    {formatCurrency(data.rows.reduce((s, r) => s + r.expenses, 0))}
                  </td>
                  <td className="px-4 py-3 text-end font-mono font-bold text-slate-700">
                    {formatCurrency(data.rows.reduce((s, r) => s + r.salaries, 0))}
                  </td>
                  <td className="px-4 py-3 text-end font-mono font-bold text-slate-700">
                    {formatCurrency(data.annualExpenses)}
                  </td>
                  <td className="px-4 py-3 text-end font-mono font-bold text-amber-700">
                    {formatCurrency(data.annualTargetRequired)}
                  </td>
                  <td className="px-4 py-3 text-end font-mono font-bold text-emerald-700">
                    {formatCurrency(data.annualCollected)}
                  </td>
                  <td className="px-4 py-3 text-end font-mono font-bold text-red-600">
                    {data.annualGap > 0 ? formatCurrency(data.annualGap) : '—'}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Distribution Calculator (T074) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧮</span>
            <div>
              <h2 className="font-bold text-slate-800">
                {isAr ? 'حاسبة توزيع الخدمات' : 'Service Distribution Calculator'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? 'أدخل عدد الطلاب/الجلسات المستهدفة لكل خدمة لحساب الإيراد المتوقع ونسبة التغطية.'
                  : 'Enter target count per service to compute projected revenue and coverage percentage.'}
              </p>
            </div>
          </div>

          {/* Month selector for context */}
          <Select
            label={isAr ? 'الشهر المرجعي' : 'Reference Month'}
            value={calcMonth}
            options={monthOptions}
            onChange={(e) => setCalcMonth(e.target.value)}
          />

          {/* Target Profit % — calculator input (feature 004, FR-014) */}
          <Input
            label={isAr ? 'نسبة الربح المستهدفة %' : 'Target Profit %'}
            type="number"
            min="0"
            max="99"
            value={calcProfitPct}
            onChange={(e) => setCalcProfitPct(e.target.value)}
            placeholder={isAr ? 'مثال: 20' : 'e.g. 20'}
          />

          <div className="space-y-3">
            <Input
              label={isAr ? 'حضانة — عدد الأطفال (شهرياً)' : 'Nursery — Children count (monthly)'}
              type="number"
              min="0"
              value={calcCounts['حضانة']}
              onChange={(e) => setCalcCounts((p) => ({ ...p, حضانة: e.target.value }))}
            />
            <Input
              label={isAr ? 'استضافة — عدد الأطفال (شهرياً)' : 'Hosting — Children count (monthly)'}
              type="number"
              min="0"
              value={calcCounts['استضافة']}
              onChange={(e) => setCalcCounts((p) => ({ ...p, استضافة: e.target.value }))}
            />
            <Input
              label={isAr ? 'جلسة — عدد الجلسات (شهرياً)' : 'Sessions — Session count (monthly)'}
              type="number"
              min="0"
              value={calcCounts['جلسة']}
              onChange={(e) => setCalcCounts((p) => ({ ...p, جلسة: e.target.value }))}
            />
          </div>

          <Button
            variant="primary"
            onClick={handleCalc}
            isLoading={isCalcing}
            className="w-full"
          >
            🔢 {isAr ? 'احسب' : 'Calculate'}
          </Button>
        </Card>

        {/* Calculator Results */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📈</span>
            <h2 className="font-bold text-slate-800">
              {isAr ? 'نتائج الحاسبة' : 'Calculator Results'}
            </h2>
          </div>

          {calcResult ? (
            <div className="space-y-5">
              {/* Revenue Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-slate-600">{isAr ? 'الإيراد المتوقع' : 'Projected Revenue'}</span>
                  <span className="text-emerald-600 font-mono">{formatCurrency(calcResult.projectedRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{isAr ? 'الهدف المطلوب' : 'Target Required'}</span>
                  <span className="text-amber-600 font-mono">{formatCurrency(calcResult.targetRequired)}</span>
                </div>

                {/* Coverage progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{isAr ? 'نسبة التغطية' : 'Coverage %'}</span>
                    <span className={`font-bold ${calcResult.coveragePct >= 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {formatPct(calcResult.coveragePct)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        calcResult.coveragePct >= 1 ? 'bg-emerald-500' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, Math.round(calcResult.coveragePct * 100))}%` }}
                    />
                  </div>
                  {calcResult.coveragePct >= 1 ? (
                    <p className="text-emerald-600 text-xs font-semibold">
                      ✅ {isAr ? 'هذا التوزيع يحقق الهدف المطلوب' : 'This distribution meets the target!'}
                    </p>
                  ) : (
                    <p className="text-amber-600 text-xs">
                      ⚠️ {isAr ? 'الهدف لم يتحقق بعد بهذا التوزيع' : 'Target not yet met with this distribution.'}
                    </p>
                  )}
                </div>
              </div>

              {/* Suggested units needed */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {isAr ? 'الوحدات المقترحة لتحقيق الهدف' : 'Suggested Units to Meet Target'}
                </p>
                {Object.entries(calcResult.unitsNeeded).map(([service, count]) => (
                  <div key={service} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">{service}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        @ {formatCurrency(calcResult.pricing[service] ?? 0)} / {isAr ? 'وحدة' : 'unit'}
                      </span>
                      <Badge variant="info">
                        {count} {isAr ? 'وحدة' : 'units'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-300 gap-3">
              <span className="text-5xl">🧮</span>
              <p className="text-sm text-slate-400">
                {isAr ? 'أدخل أعداد التوزيع واضغط احسب' : 'Enter distribution counts and click Calculate'}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}