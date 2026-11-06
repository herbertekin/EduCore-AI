import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote, FileText, Clock3, TrendingUp, RefreshCw,
CreditCard, Smartphone, AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type Invoice = {
  id: string;
  student_id: string;
  invoice_number: string;
  total_amount: number | string;
  status: string;
  issue_date: string;
};
type Payment = {
  id: string;
  student_id: string;
  receipt_number: string;
  payment_method: string;
  amount: number | string;
  payment_date: string;
  transaction_reference: string | null;
};
type InvoiceItem = { id: string; invoice_id: string };
type Allocation = { invoice_item_id: string; amount: number | string };
type Student = { id: string; first_name: string; middle_name: string | null; last_name: string | null; admission_number: string };

const money = (value: number) => new Intl.NumberFormat('en-KE', {
  style: 'currency', currency: 'KES', maximumFractionDigits: 0,
}).format(value);
const asNumber = (value: number | string | null | undefined) => Number(value ?? 0);
const monthLabel = (date: Date) => date.toLocaleDateString('en-KE', { month: 'short' });

export default function FinanceOverview({ schoolId }: { schoolId: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFinance = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [invoiceRes, paymentRes, studentRes, itemRes, allocationRes] = await Promise.all([
        supabase.from('student_invoices')
          .select('id, student_id, invoice_number, total_amount, status, issue_date')
          .eq('school_id', schoolId)
          .in('status', ['issued', 'partially_paid', 'paid'])
          .order('issue_date', { ascending: false }),
        supabase.from('student_payments')
          .select('id, student_id, receipt_number, payment_method, amount, payment_date, transaction_reference')
          .eq('school_id', schoolId)
          .order('payment_date', { ascending: false })
          .limit(500),
        supabase.from('students')
          .select('id, first_name, middle_name, last_name, admission_number')
          .eq('school_id', schoolId),
        supabase.from('student_invoice_items')
          .select('id, invoice_id')
          .eq('school_id', schoolId),
        supabase.from('payment_allocations')
          .select('invoice_item_id, amount')
          .eq('school_id', schoolId),
      ]);
      for (const response of [invoiceRes, paymentRes, studentRes, itemRes, allocationRes]) {
        if (response.error) throw response.error;
      }
      setInvoices((invoiceRes.data ?? []) as Invoice[]);
      setPayments((paymentRes.data ?? []) as Payment[]);
      setStudents((studentRes.data ?? []) as Student[]);
      setItems((itemRes.data ?? []) as InvoiceItem[]);
      setAllocations((allocationRes.data ?? []) as Allocation[]);
    } catch (e) {
      console.error('Finance overview load failed:', e);
      setError(e instanceof Error ? e.message : 'Could not load finance records. Check your Supabase permissions and try again.');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void loadFinance(); }, [loadFinance]);

  const figures = useMemo(() => {
    const invoiced = invoices.reduce((sum, row) => sum + asNumber(row.total_amount), 0);
    const collected = payments.reduce((sum, row) => sum + asNumber(row.amount), 0);
    const itemInvoice = new Map(items.map(item => [item.id, item.invoice_id]));
    const paidByInvoice = new Map<string, number>();
    for (const allocation of allocations) {
      const invoiceId = itemInvoice.get(allocation.invoice_item_id);
      if (invoiceId) paidByInvoice.set(invoiceId, (paidByInvoice.get(invoiceId) ?? 0) + asNumber(allocation.amount));
    }
    const outstandingByInvoice = invoices.map(invoice => ({
      invoice,
      outstanding: Math.max(0, asNumber(invoice.total_amount) - (paidByInvoice.get(invoice.id) ?? 0)),
    })).filter(row => row.outstanding > 0.009);
    const outstanding = outstandingByInvoice.reduce((sum, row) => sum + row.outstanding, 0);
    const rate = invoiced > 0 ? Math.min(100, (collected / invoiced) * 100) : 0;
    const methods = ['cash', 'bank', 'mpesa'].map(method => ({
      method,
      amount: payments.filter(p => p.payment_method.toLowerCase() === method)
        .reduce((sum, p) => sum + asNumber(p.amount), 0),
    }));
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const amount = payments.filter(p => p.payment_date?.slice(0, 7) === key)
        .reduce((sum, p) => sum + asNumber(p.amount), 0);
      return { key, label: monthLabel(date), amount };
    });
    const studentMap = new Map(students.map(s => [s.id, s]));
    const debtByStudent = new Map<string, number>();
    for (const row of outstandingByInvoice) {
      debtByStudent.set(row.invoice.student_id, (debtByStudent.get(row.invoice.student_id) ?? 0) + row.outstanding);
    }
    const debtors = [...debtByStudent.entries()].map(([id, balance]) => ({
      student: studentMap.get(id), balance,
    })).sort((a, b) => b.balance - a.balance).slice(0, 8);
    return { invoiced, collected, outstanding, rate, methods, months, debtors, maxMonth: Math.max(1, ...months.map(m => m.amount)), studentMap };
  }, [invoices, payments, students, items, allocations]);

  const methodIcon = (method: string) => method === 'mpesa' ? Smartphone : method === 'bank' ? CreditCard : Banknote;
  const methodName = (method: string) => method === 'mpesa' ? 'M-Pesa' : method === 'bank' ? 'Bank' : 'Cash';

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finance Overview</h1>
          <p className="mt-1 text-sm text-slate-500">A live summary of recorded invoices, payments and outstanding balances.</p>
        </div>
        <button onClick={() => void loadFinance()} disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total invoiced', value: figures.invoiced, detail: 'Issued, partially paid and paid invoices', icon: FileText, tone: 'blue' },
          { label: 'Total collected', value: figures.collected, detail: 'Recorded student payments', icon: Banknote, tone: 'emerald' },
          { label: 'Outstanding balance', value: figures.outstanding, detail: 'Invoice value less allocated payments', icon: Clock3, tone: 'amber' },
          { label: 'Collection rate', value: figures.rate, detail: 'Collected divided by invoiced', icon: TrendingUp, tone: 'violet' },
        ].map(card => {
          const Icon = card.icon;
          const value = card.label === 'Collection rate' ? `${card.value.toFixed(1)}%` : money(card.value);
          return <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <span className="rounded-lg bg-slate-100 p-2 text-slate-700"><Icon className="h-5 w-5" /></span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{loading ? '—' : value}</p>
            <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
          </div>;
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-2">
          <h2 className="font-semibold text-slate-900">Monthly collections</h2>
          <p className="mt-1 text-xs text-slate-500">Based on payment dates in the latest six calendar months.</p>
          <div className="mt-6 flex h-56 items-end gap-3 border-b border-slate-100 pb-2">
            {figures.months.map(month => <div key={month.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span className="text-[10px] text-slate-500">{month.amount ? money(month.amount) : '—'}</span>
              <div className="flex h-36 w-full items-end rounded-t-md bg-slate-100">
                <div className="w-full rounded-t-md bg-emerald-600" style={{ height: `${month.amount ? Math.max(4, month.amount / figures.maxMonth * 100) : 0}%` }} />
              </div>
              <span className="text-xs text-slate-500">{month.label}</span>
            </div>)}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Payment methods</h2>
          <p className="mt-1 text-xs text-slate-500">Recorded payment totals by method.</p>
          <div className="mt-5 space-y-5">
            {figures.methods.map(row => {
              const Icon = methodIcon(row.method);
              const share = figures.collected ? row.amount / figures.collected * 100 : 0;
              return <div key={row.method}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-700"><Icon className="h-4 w-4" />{methodName(row.method)}</span>
                  <span className="font-semibold text-slate-900">{money(row.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${share}%` }} /></div>
                <p className="mt-1 text-right text-xs text-slate-400">{share.toFixed(1)}%</p>
              </div>;
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Students with outstanding fees</h2>
          <p className="mt-1 text-xs text-slate-500">Top balances calculated from invoice allocations.</p>
          {figures.debtors.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">{loading ? 'Loading balances…' : 'No outstanding balances found.'}</p> :
            <div className="mt-4 divide-y divide-slate-100">
              {figures.debtors.map(row => <div key={row.student ? row.student.id : Math.random()} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{row.student ? [row.student.first_name, row.student.middle_name, row.student.last_name].filter(Boolean).join(' ') : 'Student record unavailable'}</p>
                  <p className="text-xs text-slate-500">{row.student?.admission_number ?? '—'}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-amber-700">{money(row.balance)}</p>
              </div>)}
            </div>}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Recent transactions</h2>
          <p className="mt-1 text-xs text-slate-500">Latest recorded payments.</p>
          {payments.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">{loading ? 'Loading payments…' : 'No payments recorded yet.'}</p> :
            <div className="mt-4 divide-y divide-slate-100">
              {payments.slice(0, 7).map(payment => {
                const student = figures.studentMap.get(payment.student_id);
                return <div key={payment.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{student ? [student.first_name, student.last_name].filter(Boolean).join(' ') : payment.receipt_number}</p>
                    <p className="text-xs text-slate-500">{payment.receipt_number} · {new Date(payment.payment_date).toLocaleDateString('en-KE')}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-slate-900">{money(asNumber(payment.amount))}</p>
                    <p className="text-xs capitalize text-slate-500">{methodName(payment.payment_method.toLowerCase())}</p>
                  </div>
                </div>;
              })}
            </div>}
        </section>
      </div>
      <p className="text-xs leading-5 text-slate-400">Figures reflect records visible to your signed-in account under current Supabase row-level security policies. Payments are counted from recorded payment rows; outstanding balances are calculated from invoice-item allocations.</p>
    </div>
  );
}
