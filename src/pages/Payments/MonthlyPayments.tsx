import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { usePaymentsStore } from '../../store/usePaymentsStore.js'
import { usePaymentMethodsStore } from '../../store/usePaymentMethodsStore.js'
import { useExport } from '../../hooks/useExport.js'
import PaymentRow from './PaymentRow.js'
import { Card } from '../../components/ui/Card.js'
import { Stat } from '../../components/ui/Stat.js'
import { Button } from '../../components/ui/Button.js'
import { Select } from '../../components/ui/Select.js'
import { Alert } from '../../components/ui/Alert.js'
import * as React from 'react'

const arabicMonths = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
]

const englishMonths = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const yearsList = [2024, 2025, 2026, 2027, 2028, 2029, 2030]

export default function MonthlyPayments() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const { exportMonth } = useExport()

  const {
    payments,
    byChild,
    summary,
    isLoading,
    error,
    currentMonth,
    currentYear,
    setPeriod,
    fetchPayments,
    generatePayments,
    updatePayment,
    bulkPay,
    clearError,
  } = usePaymentsStore()

  const { methods: paymentMethods, fetchMethods: fetchPaymentMethods } = usePaymentMethodsStore()

  useEffect(() => { fetchPaymentMethods() }, [])

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all')

  // Selection state
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkMethodId, setBulkMethodId] = useState<number | ''>('')
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  // Fetch payments on mount
  useEffect(() => {
    fetchPayments()
  }, [])

  // Clear selection when period changes
  useEffect(() => {
    setSelectedIds([])
  }, [currentMonth, currentYear])

  // Localized months options
  const monthOptions = useMemo(() => {
    return arabicMonths.map((m, idx) => ({
      value: m,
      label: i18n.language === 'ar' ? m : englishMonths[idx],
    }))
  }, [i18n.language])

  const yearOptions = useMemo(() => {
    return yearsList.map((y) => ({
      value: y,
      label: y.toString(),
    }))
  }, [])

  const filteredByChild = useMemo(() => {
    let data = byChild ?? []
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      data = data.filter((g: any) => g.child_name?.toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') {
      data = data.filter((g: any) => g.status === statusFilter)
    }
    return data
  }, [byChild, searchQuery, statusFilter])

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPeriod(e.target.value, currentYear)
  }

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPeriod(currentMonth, Number(e.target.value))
  }

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (selectedIds.length === payments.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(payments.map((p) => p.id))
    }
  }

  const handleToggleSelectRow = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    )
  }

  // Bulk Payment
  const [isBulkPaying, setIsBulkPaying] = useState(false)
  const handleBulkPay = async () => {
    if (selectedIds.length === 0) return
    setIsBulkPaying(true)
    const count = await bulkPay(selectedIds, bulkMethodId !== '' ? Number(bulkMethodId) : null)
    setIsBulkPaying(false)
    if (count > 0) setSelectedIds([])
  }

  // Update row
  const handleUpdateRow = async (id: number, quantity: number, paid: number, notes: string, payment_method_id?: number | null) => {
    return await updatePayment({ id, quantity, paid, notes, payment_method_id })
  }

  // Generate payments for this period
  const [isGenerating, setIsGenerating] = useState(false)
  const handleGenerate = async () => {
    setIsGenerating(true)
    await generatePayments()
    setIsGenerating(false)
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency: 'EGP',
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    if (status === 'paid') return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">{t('paid', 'Paid')}</span>
    if (status === 'partial') return <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">{t('partial', 'Partial')}</span>
    return <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">{t('unpaid', 'Unpaid')}</span>
  }

  // Export handlers
  const handleExport = async (format: 'xlsx' | 'pdf') => {
    if (format === 'xlsx') {
      setIsExportingExcel(true)
    } else {
      setIsExportingPdf(true)
    }

    try {
      const result = await exportMonth(currentMonth, currentYear, format)
      if (result && result.filePath) {
        console.log(`Exported successfully to: ${result.filePath}`)
      }
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExportingExcel(false)
      setIsExportingPdf(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('payments')}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {i18n.language === 'ar'
              ? 'متابعة سداد اشتراكات ومطالبات الأطفال الشهرية.'
              : 'Track and record monthly child billing and collections.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {payments.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => handleExport('xlsx')}
                isLoading={isExportingExcel}
                disabled={isExportingPdf}
              >
                📊 {i18n.language === 'ar' ? 'تصدير إكسل' : 'Excel Export'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport('pdf')}
                isLoading={isExportingPdf}
                disabled={isExportingExcel}
              >
                📕 {i18n.language === 'ar' ? 'تصدير PDF' : 'PDF Export'}
              </Button>
            </>
          )}
          <Button variant="primary" onClick={handleGenerate} isLoading={isGenerating}>
            ⚡ {t('generate_payments')}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" title={t('error')} onClose={clearError}>
          {error}
        </Alert>
      )}

      {/* Selectors and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Period Selector Card */}
        <Card className="p-4 space-y-4">
          <h3 className="font-semibold text-slate-700 border-b border-slate-100 pb-2">
            📅 {i18n.language === 'ar' ? 'الفترة الزمنية' : 'Billing Period'}
          </h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">{t('select_month')}</span>
              <Select value={currentMonth} onChange={handleMonthChange} options={monthOptions} />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">{t('select_year')}</span>
              <Select value={currentYear} onChange={handleYearChange} options={yearOptions} />
            </div>
          </div>
        </Card>

        {/* Summary stats */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Stat
            title={t('invoiced')}
            value={formatCurrency(summary.totalInvoiced)}
            icon="💰"
          />
          <Stat
            title={t('collected')}
            value={formatCurrency(summary.totalCollected)}
            icon="✅"
          />
          <Stat
            title={t('arrears')}
            value={formatCurrency(summary.arrears)}
            icon="⚠️"
          />
        </div>
      </div>

      {/* Search & Filter Bar */}
      {payments.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute inset-y-0 start-3 flex items-center pointer-events-none text-slate-400">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث باسم الطفل…' : 'Search by child name…'}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 ps-9 pe-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 end-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold uppercase whitespace-nowrap">
              {isAr ? 'الحالة:' : 'Status:'}
            </span>
            {(['all', 'paid', 'partial', 'unpaid'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  statusFilter === s
                    ? s === 'all'
                      ? 'bg-slate-700 text-white border-slate-700'
                      : s === 'paid'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : s === 'partial'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                }`}
              >
                {s === 'all'
                  ? isAr ? 'الكل' : 'All'
                  : s === 'paid'
                  ? isAr ? 'مدفوع' : 'Paid'
                  : s === 'partial'
                  ? isAr ? 'جزئي' : 'Partial'
                  : isAr ? 'غير مدفوع' : 'Unpaid'}
              </button>
            ))}
            {(searchQuery || statusFilter !== 'all') && (
              <span className="text-xs text-slate-400 ms-1">
                {isAr
                  ? `${filteredByChild.length} من ${byChild?.length ?? 0}`
                  : `${filteredByChild.length} of ${byChild?.length ?? 0}`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main content table */}
      <Card className="overflow-hidden">
        {isLoading && payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 gap-3">
            <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-slate-500 font-medium">
              جاري التحميل... / Loading...
            </span>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center p-16 space-y-6">
            <div className="text-5xl">📝</div>
            <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
              {t('no_payments')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Bulk actions header */}
            {selectedIds.length > 0 && (
              <div className="bg-primary/5 px-6 py-3 border-b border-slate-200 flex items-center justify-between transition-all">
                <span className="text-sm font-semibold text-primary">
                  {isAr
                    ? `تم تحديد ${selectedIds.length} من أصل ${payments.length} مطالبات`
                    : `Selected ${selectedIds.length} of ${payments.length} records`}
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={bulkMethodId}
                    onChange={(e) => setBulkMethodId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-primary"
                  >
                    <option value="">{isAr ? '— طريقة الدفع —' : '— Payment method —'}</option>
                    {paymentMethods.filter(m => m.is_active === 1).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <Button variant="secondary" size="sm" onClick={handleBulkPay} isLoading={isBulkPaying}>
                    💵 {t('bulk_pay_selected')}
                  </Button>
                </div>
              </div>
            )}

            {/* Scrollable table container */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-slate-500 border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold text-start border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-center w-12">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === payments.length && payments.length > 0}
                        onChange={handleToggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                      />
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{t('child_name')}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{t('service')}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{t('price')}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{i18n.language === 'ar' ? 'الكمية' : 'Qty'}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{t('total')}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{i18n.language === 'ar' ? 'المدفوع' : 'Paid'}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{i18n.language === 'ar' ? 'المتبقي' : 'Balance'}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{t('status')}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{isAr ? 'طريقة الدفع' : 'Payment Method'}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{t('notes')}</th>
                    <th scope="col" className="px-4 py-3 text-center font-semibold">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredByChild && filteredByChild.length > 0 ? filteredByChild.map((childGroup) => {
                    const childPaymentIds = childGroup.services.map((s: any) => s.id)
                    const isAllSelected = childPaymentIds.every((id: number) => selectedIds.includes(id))
                    
                    const handleToggleChildSelect = () => {
                      if (isAllSelected) {
                        setSelectedIds(prev => prev.filter(id => !childPaymentIds.includes(id)))
                      } else {
                        setSelectedIds(prev => [...new Set([...prev, ...childPaymentIds])])
                      }
                    }

                    return (
                      <React.Fragment key={childGroup.child_id}>
                        <tr className="bg-slate-50/50 border-t-2 border-slate-200">
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isAllSelected && childPaymentIds.length > 0}
                              onChange={handleToggleChildSelect}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap text-start">
                            {childGroup.child_name}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 font-semibold" colSpan={4}>
                            {i18n.language === 'ar' ? `إجمالي الطفل (${childGroup.services.length} خدمات)` : `Child Total (${childGroup.services.length} services)`}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-800 whitespace-nowrap text-start">
                            {formatCurrency(childGroup.totalInvoiced)}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-800 whitespace-nowrap text-start">
                            {formatCurrency(childGroup.totalCollected)}
                          </td>
                          <td className="px-4 py-3 font-mono whitespace-nowrap text-start">
                            {childGroup.balance < 0 ? (
                              <span className="text-emerald-600 font-bold">
                                {formatCurrency(Math.abs(childGroup.balance))} ({i18n.language === 'ar' ? 'رصيد' : 'Credit'})
                              </span>
                            ) : childGroup.balance > 0 ? (
                              <span className="text-red-600 font-bold">{formatCurrency(childGroup.balance)}</span>
                            ) : (
                              <span className="text-slate-400 font-bold">0.00</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-start">
                            {getStatusBadge(childGroup.status)}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                        {childGroup.services.map((payment: any) => (
                          <PaymentRow
                            key={payment.id}
                            payment={payment}
                            isSelected={selectedIds.includes(payment.id)}
                            onToggleSelect={() => handleToggleSelectRow(payment.id)}
                            onUpdate={handleUpdateRow}
                            paymentMethods={paymentMethods}
                          />
                        ))}
                      </React.Fragment>
                    )
                  }) : (
                    payments.map((payment) => (
                      <PaymentRow
                        key={payment.id}
                        payment={payment}
                        isSelected={selectedIds.includes(payment.id)}
                        onToggleSelect={() => handleToggleSelectRow(payment.id)}
                        onUpdate={handleUpdateRow}
                        paymentMethods={paymentMethods}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}