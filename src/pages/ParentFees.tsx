import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Props = {
  studentId: string
  studentName: string
  onBack: () => void
}

type Invoice = {
  id: string
  invoice_number: string
  issue_date: string
  due_date: string | null
  total_amount: number
  status: string
}

type InvoiceItem = {
  id: string
  invoice_id: string
  votehead_name: string
  amount: number
}

type Payment = {
  id: string
  receipt_number: string
  payment_method: string
  amount: number
  payment_date: string
}

type Allocation = {
  payment_id: string
  invoice_item_id: string
  amount: number
}

const money = (amount: number) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 2,
  }).format(amount)

function ParentFees({ studentId, studentName, onBack }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadFees = async () => {
      setLoading(true)
      setError('')

      try {
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('student_invoices')
          .select('id, invoice_number, issue_date, due_date, total_amount, status')
          .eq('student_id', studentId)
          .in('status', ['issued', 'partially_paid', 'paid'])
          .order('issue_date', { ascending: false })

        if (invoiceError) throw invoiceError

        const loadedInvoices = (invoiceData ?? []) as Invoice[]
        const invoiceIds = loadedInvoices.map((invoice) => invoice.id)

        if (invoiceIds.length === 0) {
          if (!cancelled) {
            setInvoices([])
            setItems([])
            setPayments([])
            setAllocations([])
          }
          return
        }

        const { data: itemData, error: itemError } = await supabase
          .from('student_invoice_items')
          .select('id, invoice_id, votehead_name, amount')
          .in('invoice_id', invoiceIds)

        if (itemError) throw itemError

        const loadedItems = (itemData ?? []) as InvoiceItem[]
        const itemIds = loadedItems.map((item) => item.id)

        const { data: paymentData, error: paymentError } = await supabase
          .from('student_payments')
          .select('id, receipt_number, payment_method, amount, payment_date')
          .eq('student_id', studentId)
          .order('payment_date', { ascending: false })

        if (paymentError) throw paymentError

        const loadedPayments = (paymentData ?? []) as Payment[]
        const paymentIds = loadedPayments.map((payment) => payment.id)

        let loadedAllocations: Allocation[] = []

        if (itemIds.length > 0 && paymentIds.length > 0) {
          const { data: allocationData, error: allocationError } = await supabase
            .from('payment_allocations')
            .select('payment_id, invoice_item_id, amount')
            .in('invoice_item_id', itemIds)
            .in('payment_id', paymentIds)

          if (allocationError) throw allocationError
          loadedAllocations = (allocationData ?? []) as Allocation[]
        }

        if (!cancelled) {
          setInvoices(loadedInvoices)
          setItems(loadedItems)
          setPayments(loadedPayments)
          setAllocations(loadedAllocations)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load school fee records.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadFees()
    return () => { cancelled = true }
  }, [studentId])

  const getInvoiceItems = (invoiceId: string) =>
    items.filter((item) => item.invoice_id === invoiceId)

  const getInvoicePaid = (invoiceId: string) => {
    const invoiceItemIds = getInvoiceItems(invoiceId).map((item) => item.id)
    return allocations
      .filter((allocation) => invoiceItemIds.includes(allocation.invoice_item_id))
      .reduce((sum, allocation) => sum + Number(allocation.amount), 0)
  }

  const totalInvoiced = invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0)
  const totalPaid = allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0)
  const balance = Math.max(0, totalInvoiced - totalPaid)

  if (loading) {
    return <main className="min-h-screen bg-slate-100 p-6"><p className="text-slate-600">Loading fee records...</p></main>
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white p-5">
        <button onClick={onBack} className="text-sm text-slate-300 hover:text-white mb-3">
          ← Back to Parent Portal
        </button>
        <h1 className="text-2xl font-bold">School Fees</h1>
        <p className="text-slate-300 text-sm mt-1">{studentName}</p>
      </header>

      <section className="max-w-6xl mx-auto p-6">
        {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-5">{error}</div>}

        {!error && (
          <>
            <div className="grid gap-4 md:grid-cols-3 mb-8">
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-slate-500">Total Invoiced</p>
                <h2 className="text-2xl font-bold text-slate-900 mt-2">{money(totalInvoiced)}</h2>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-slate-500">Total Allocated</p>
                <h2 className="text-2xl font-bold text-emerald-600 mt-2">{money(totalPaid)}</h2>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <p className="text-sm text-slate-500">Outstanding Balance</p>
                <h2 className="text-2xl font-bold text-red-600 mt-2">{money(balance)}</h2>
              </div>
            </div>

            <section className="bg-white rounded-xl shadow-sm p-6 mb-8">
              <h2 className="text-xl font-bold text-slate-900 mb-5">Fee Invoices</h2>
              {invoices.length === 0 ? (
                <p className="text-slate-500">No issued fee invoices are available.</p>
              ) : (
                <div className="space-y-5">
                  {invoices.map((invoice) => {
                    const paid = getInvoicePaid(invoice.id)
                    const outstanding = Math.max(0, Number(invoice.total_amount) - paid)

                    return (
                      <div key={invoice.id} className="border border-slate-200 rounded-lg p-5">
                        <div className="flex flex-wrap justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-slate-900">{invoice.invoice_number}</h3>
                            <p className="text-sm text-slate-500 mt-1">Issued: {invoice.issue_date}</p>
                            <p className="text-sm text-slate-500">Due: {invoice.due_date ?? 'Not specified'}</p>
                          </div>
                          <span className="text-sm font-semibold capitalize text-emerald-700">
                            {invoice.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="mt-4 space-y-2">
                          {getInvoiceItems(invoice.id).map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-slate-600">{item.votehead_name}</span>
                              <span className="font-medium">{money(Number(item.amount))}</span>
                            </div>
                          ))}
                        </div>

                        <div className="border-t mt-4 pt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Total invoiced</span><strong>{money(Number(invoice.total_amount))}</strong>
                          </div>
                          <div className="flex justify-between text-sm text-emerald-700">
                            <span>Allocated payments</span><strong>{money(paid)}</strong>
                          </div>
                          <div className="flex justify-between text-sm text-red-600">
                            <span>Outstanding</span><strong>{money(outstanding)}</strong>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-5">Payment History</h2>
              {payments.length === 0 ? (
                <p className="text-slate-500">No payment records found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="p-3">Receipt</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Method</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-t">
                          <td className="p-3 font-medium">{payment.receipt_number}</td>
                          <td className="p-3">{payment.payment_date}</td>
                          <td className="p-3 capitalize">{payment.payment_method}</td>
                          <td className="p-3 text-right font-semibold">{money(Number(payment.amount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  )
}

export default ParentFees
