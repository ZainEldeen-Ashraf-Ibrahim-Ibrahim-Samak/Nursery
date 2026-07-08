import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDailyPaymentsStore } from '../../store/useDailyPaymentsStore.js'
import { usePaymentMethodsStore } from '../../store/usePaymentMethodsStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import PaymentRow from './PaymentRow.js'
import DailyPaymentInstallmentsModal from './DailyPaymentInstallmentsModal.js'
import type { Payment, DailyPayment } from '../../types/index.js'
import { Card } from '../../components/ui/Card.js'
import { Stat } from '../../components/ui/Stat.js'
import { Button } from '../../components/ui/Button.js'
import { Alert } from '../../components/ui/Alert.js'
import { Modal } from '../../components/ui/Modal.js'
import * as React from 'react'

export default function DailyPayments() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'

  const {
    payments,
    byChild,
    summary,
    isLoading,
    error,
    currentDate,
    setDate,
    fetchDailyPayments,
    generateDailyPayments,
    updateDailyPayment,
    bulkPay,
    deleteForChild,
    deleteSelected,
    deleteAll,
    clearError,
  } = useDailyPaymentsStore()

  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const { methods: paymentMethods, fetchMethods: fetchPaymentMethods } = usePaymentMethodsStore()

  useEffect(() => { fetchPaymentMethods() }, [])

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [phoneQuery, setPhoneQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all')

  // Selection state
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkMethodId, setBulkMethodId] = useState<number | ''>('')

  // Fetch payments on mount
  useEffect(() => {
    fetchDailyPayments()
  }, [])

  // Clear selection when date changes
  useEffect(() => {
    setSelectedIds([])
  }, [currentDate])

  const filteredByChild = useMemo(() => {
    let data = byChild ?? []
    // Name filter: match child name or guardian name
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      data = data.filter((g: any) =>
        g.child_name?.toLowerCase().includes(q) ||
        g.child_guardian?.toLowerCase().includes(q)
      )
    }
    // Phone filter: digits-only partial match
    if (phoneQuery.trim()) {
      const digits = phoneQuery.trim().replace(/\D/g, '')
      if (digits.length >= 3) {
        data = data.filter((g: any) => {
          const phone = (g.child_guardian_phone ?? '').replace(/\D/g, '')
          return phone.includes(digits)
        })
      }
    }
    if (statusFilter !== 'all') {
      data = data.filter((g: any) => g.status === statusFilter)
    }
    return data
  }, [byChild, searchQuery, phoneQuery, statusFilter])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value)
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

  const [confirmDeleteMode, setConfirmDeleteMode] = useState<'selected' | 'all' | null>(null)
  const [isDeletingPayments, setIsDeletingPayments] = useState(false)
  const [installmentsFor, setInstallmentsFor] = useState<DailyPayment | null>(null)

  const handleConfirmDelete = async () => {
    setIsDeletingPayments(true)
    if (confirmDeleteMode === 'selected') {
      const count = await deleteSelected(selectedIds)
      if (count > 0) setSelectedIds([])
    } else if (confirmDeleteMode === 'all') {
      await deleteAll()
      setSelectedIds([])
    }
    setIsDeletingPayments(false)
    setConfirmDeleteMode(null)
  }

  // Update row
  const handleUpdateRow = async (id: number, quantity: number, paid: number, notes: string, payment_method_id?: number | null) => {
    return await updateDailyPayment({ id, quantity, paid, notes, payment_method_id })
  }

  // Generate payments for this period
  const [isGenerating, setIsGenerating] = useState(false)
  const handleGenerate = async () => {
    setIsGenerating(true)
    await generateDailyPayments()
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

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('daily_billing', 'Daily Billing')}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAr
              ? 'إدارة مطالبات الدفع للخدمات اليومية للأطفال'
              : 'Manage daily payment records for children services'}
          </p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={handleGenerate} isLoading={isGenerating}>
            ✨ {t('generate_daily_payments', 'Generate Daily Bills')}
          </Button>

          {isAdmin && payments.length > 0 && (
            <Button
              variant="danger"
              onClick={() => setConfirmDeleteMode('all')}
            >
              🗑️ {isAr ? 'حذف الجميع' : 'Delete All'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="danger" onClose={clearError} title={isAr ? 'خطأ' : 'Error'}>
          {error}
        </Alert>
      )}

      {/* Date & Search Bar */}
      <Card className="p-4 bg-white/50 backdrop-blur">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5 md:col-span-1">
            <label className="block text-sm font-medium text-slate-700">
              {t('daily_billing_period', 'Billing Date')}
            </label>
            <input
              type="date"
              className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:border-primary focus:ring-primary"
              value={currentDate}
              onChange={handleDateChange}
            />
          </div>

          <div className="space-y-1.5 md:col-span-1">
            <label className="block text-sm font-medium text-slate-700">
              {t('search', 'Search')}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-slate-400">
                🔍
              </span>
              <input
                type="text"
                placeholder={isAr ? 'الاسم أو ولي الأمر...' : 'Name or Guardian...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:border-primary focus:ring-primary ps-10"
              />
            </div>
          </div>
          
          <div className="space-y-1.5 md:col-span-1">
            <label className="block text-sm font-medium text-slate-700">
              {t('phone', 'Phone')}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-slate-400">
                📱
              </span>
              <input
                type="text"
                placeholder={isAr ? 'رقم الهاتف...' : 'Phone number...'}
                value={phoneQuery}
                onChange={(e) => setPhoneQuery(e.target.value)}
                className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:border-primary focus:ring-primary ps-10"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Summary Stats */}
      {payments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat
            title={t('total_invoiced')}
            value={formatCurrency(summary.totalInvoiced)}
          />
          <Stat
            title={t('total_collected')}
            value={formatCurrency(summary.totalCollected)}
          />
          <Stat
            title={t('arrears')}
            value={formatCurrency(summary.arrears)}
          />
        </div>
      )}

      {/* Status Filters */}
      {payments.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
          <div className="flex gap-2">
            {(['all', 'paid', 'partial', 'unpaid'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
                  statusFilter === s
                    ? s === 'all'
                      ? 'bg-slate-800 text-white border-slate-800'
                      : s === 'paid'
                      ? 'bg-emerald-500 text-white border-emerald-500'
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
            {(searchQuery || phoneQuery || statusFilter !== 'all') && (
              <span className="text-xs text-slate-400 ms-1 flex items-center">
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
              {t('no_daily_payments', 'لا توجد مطالبات مسجلة لهذا اليوم. اضغط على "توليد مطالبات اليوم" للبدء. / No records for this date.')}
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
                  {isAdmin && (
                    <Button variant="danger" size="sm" onClick={() => setConfirmDeleteMode('selected')}>
                      🗑️ {isAr ? 'حذف المحدد' : 'Delete Selected'}
                    </Button>
                  )}
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
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{isAr ? 'الكمية' : 'Qty'}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{t('total')}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{isAr ? 'المدفوع' : 'Paid'}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{isAr ? 'المتبقي' : 'Balance'}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{t('status')}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{isAr ? 'طريقة الدفع' : 'Payment Method'}</th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">{t('notes')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredByChild.map((group: any) => (
                    <React.Fragment key={group.child_id}>
                      <tr className="bg-slate-50/80 hover:bg-slate-50 transition-colors group/parent">
                        <td className="px-4 py-2 border-b border-slate-100"></td>
                        <td className="px-4 py-2 font-bold text-slate-900 border-b border-slate-100 flex items-center gap-2">
                          {group.child_name}
                          {!group.child_is_active && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                              {t('inactive', 'Inactive')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 border-b border-slate-100 text-xs text-slate-400 font-medium">
                          {group.child_guardian && group.child_guardian_phone
                            ? `${group.child_guardian} - ${group.child_guardian_phone}`
                            : group.child_guardian || group.child_guardian_phone}
                        </td>
                        <td className="px-4 py-2 border-b border-slate-100" colSpan={2}></td>
                        <td className="px-4 py-2 font-semibold text-slate-900 border-b border-slate-100">{group.totalInvoiced}</td>
                        <td className="px-4 py-2 font-semibold text-emerald-600 border-b border-slate-100">{group.totalCollected}</td>
                        <td className="px-4 py-2 font-semibold text-red-600 border-b border-slate-100">{group.balance}</td>
                        <td className="px-4 py-2 border-b border-slate-100">{getStatusBadge(group.status)}</td>
                        <td className="px-4 py-2 border-b border-slate-100"></td>
                        <td className="px-4 py-2 border-b border-slate-100 text-end">
                          {isAdmin && !group.child_is_active && (
                            <button
                              onClick={() => {
                                if (confirm(isAr ? 'هل أنت متأكد من حذف هذا السجل للطفل غير النشط؟' : 'Delete this record for inactive child?')) {
                                  deleteForChild(group.child_id)
                                }
                              }}
                              className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover/parent:opacity-100 transition-opacity"
                              title={isAr ? 'حذف من القائمة' : 'Delete from list'}
                            >
                              🗑️
                            </button>
                          )}
                        </td>
                      </tr>
                        {group.services.map((p: any) => (
                          <PaymentRow
                            key={p.id}
                            payment={p as Payment}
                            isSelected={selectedIds.includes(p.id)}
                            onToggleSelect={() => handleToggleSelectRow(p.id)}
                            onUpdate={handleUpdateRow}
                            onOpenInstallments={() => setInstallmentsFor(p as DailyPayment)}
                            paymentMethods={paymentMethods}
                          />
                        ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={confirmDeleteMode !== null}
        onClose={() => setConfirmDeleteMode(null)}
        title={isAr ? 'تأكيد الحذف' : 'Confirm Deletion'}
      >
        <div className="space-y-4">
          <p className="text-slate-600 text-sm">
            {confirmDeleteMode === 'selected'
              ? (isAr
                ? `هل أنت متأكد من حذف ${selectedIds.length} مطالبات محددة؟ هذا الإجراء لا يمكن التراجع عنه.`
                : `Are you sure you want to delete the ${selectedIds.length} selected records? This cannot be undone.`)
              : (isAr
                ? `هل أنت متأكد من حذف جميع مطالبات هذا اليوم (${currentDate})؟ هذا الإجراء لا يمكن التراجع عنه.`
                : `Are you sure you want to delete ALL records for this date (${currentDate})? This cannot be undone.`)}
          </p>
          <div className="bg-red-50 p-3 rounded-md text-red-700 text-xs border border-red-200">
            ⚠️ {isAr
              ? 'تنبيه: لن يتم الاحتفاظ بأي سجلات مدفوعة أو أرصدة بعد الحذف.'
              : 'Warning: Paid records and balances will not be retained after deletion.'}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setConfirmDeleteMode(null)}>
              {t('cancel')}
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete} isLoading={isDeletingPayments}>
              {isAr ? 'نعم، قم بالحذف' : 'Yes, Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {installmentsFor && (
        <DailyPaymentInstallmentsModal
          payment={installmentsFor}
          paymentMethods={paymentMethods}
          onClose={() => setInstallmentsFor(null)}
          onChanged={() => fetchDailyPayments()}
        />
      )}

    </div>
  )
}
