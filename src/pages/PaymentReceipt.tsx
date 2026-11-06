import { useEffect, useState } from 'react';
import { Printer, X, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Props = { paymentId: string; schoolId: string; onClose: () => void };
type School = { name: string; school_code: string; county: string | null; sub_county: string | null; address: string | null; phone: string | null; email: string | null };
type Payment = { id: string; student_id: string; receipt_number: string; payment_method: string; transaction_reference: string | null; amount: number; payment_date: string; notes: string | null; received_by: string };
type Student = { admission_number: string; first_name: string; middle_name: string | null; last_name: string | null };
type Invoice = { invoice_number: string; issue_date: string; due_date: string | null };
type Allocation = { invoice_item_id: string; amount: number };
type InvoiceItem = { id: string; invoice_id: string; votehead_code: string; votehead_name: string };
type ReceiptLine = { code: string; name: string; amount: number };

const money = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

export default function PaymentReceipt({ paymentId, schoolId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [school, setSchool] = useState<School | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<ReceiptLine[]>([]);

  useEffect(() => {
    let active = true;
    const loadReceipt = async () => {
      setLoading(true);
      setError('');
      try {
        const [schoolRes, paymentRes] = await Promise.all([
          supabase.from('schools').select('name, school_code, county, sub_county, address, phone, email').eq('id', schoolId).single(),
          supabase.from('student_payments').select('id, student_id, receipt_number, payment_method, transaction_reference, amount, payment_date, notes, received_by').eq('id', paymentId).eq('school_id', schoolId).single(),
        ]);
        if (schoolRes.error) throw schoolRes.error;
        if (paymentRes.error) throw paymentRes.error;
        const p = paymentRes.data as Payment;

        const [studentRes, allocationRes] = await Promise.all([
          supabase.from('students').select('admission_number, first_name, middle_name, last_name').eq('id', p.student_id).eq('school_id', schoolId).single(),
          supabase.from('payment_allocations').select('invoice_item_id, amount').eq('payment_id', paymentId).eq('school_id', schoolId),
        ]);
        if (studentRes.error) throw studentRes.error;
        if (allocationRes.error) throw allocationRes.error;
        const allocations = (allocationRes.data || []) as Allocation[];
        const itemIds = allocations.map((a) => a.invoice_item_id);
        if (itemIds.length === 0) throw new Error('No invoice allocations were found for this payment.');

        const { data: itemData, error: itemError } = await supabase
          .from('student_invoice_items')
          .select('id, invoice_id, votehead_code, votehead_name')
          .eq('school_id', schoolId)
          .in('id', itemIds);
        if (itemError) throw itemError;
        const invoiceItems = (itemData || []) as InvoiceItem[];
        if (invoiceItems.length === 0) throw new Error('The invoice items for this receipt could not be found.');
        const invoiceIds = [...new Set(invoiceItems.map((item) => item.invoice_id))];
        if (invoiceIds.length !== 1) throw new Error('This receipt is linked to more than one invoice; contact your administrator.');

        const { data: invoiceData, error: invoiceError } = await supabase
          .from('student_invoices')
          .select('invoice_number, issue_date, due_date')
          .eq('id', invoiceIds[0])
          .eq('school_id', schoolId)
          .single();
        if (invoiceError) throw invoiceError;

        const receiptLines = invoiceItems.map((item) => ({
          code: item.votehead_code,
          name: item.votehead_name,
          amount: allocations.filter((a) => a.invoice_item_id === item.id).reduce((sum, a) => sum + Number(a.amount), 0),
        })).filter((line) => line.amount > 0);

        if (active) {
          setSchool(schoolRes.data as School);
          setPayment(p);
          setStudent(studentRes.data as Student);
          setInvoice(invoiceData as Invoice);
          setLines(receiptLines);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load this receipt.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadReceipt();
    return () => { active = false; };
  }, [paymentId, schoolId]);

  const studentName = student ? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ') : '';

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 p-3 sm:p-6 no-print">
      <style>{`@media print { @page { size: A4; margin: 14mm; } body * { visibility: hidden !important; } .receipt-print-area, .receipt-print-area * { visibility: visible !important; } .receipt-print-area { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: 0 !important; } .receipt-actions { display: none !important; } }`}</style>
      <div className="mx-auto max-w-3xl">
        <div className="receipt-actions mb-3 flex justify-end gap-2">
          <button type="button" onClick={() => window.print()} disabled={loading || !!error} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Printer size={16} /> Print / Save PDF</button>
          <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700"><X size={16} /> Close</button>
        </div>
        {loading ? (
          <div className="rounded-xl bg-white p-10 text-center text-slate-500"><RefreshCw className="mx-auto mb-3 animate-spin" />Loading receipt...</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-white p-6 text-red-700">{error}</div>
        ) : school && payment && student && invoice ? (
          <article className="receipt-print-area rounded-xl border border-slate-200 bg-white p-7 shadow-xl sm:p-10">
            <header className="flex flex-col justify-between gap-5 border-b-2 border-emerald-700 pb-6 sm:flex-row">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Official payment receipt</p>
                <h1 className="mt-2 text-2xl font-extrabold text-slate-900">{school.name}</h1>
                <p className="mt-1 text-sm text-slate-600">School Code: {school.school_code}</p>
                {[school.address, [school.sub_county, school.county].filter(Boolean).join(', ')].filter(Boolean).map((line) => <p key={line} className="text-sm text-slate-600">{line}</p>)}
                {school.phone && <p className="text-sm text-slate-600">Tel: {school.phone}</p>}
                {school.email && <p className="text-sm text-slate-600">Email: {school.email}</p>}
              </div>
              <div className="sm:text-right">
                <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">Payment received</span>
                <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">Receipt number</p>
                <p className="text-xl font-extrabold text-slate-900">{payment.receipt_number}</p>
                <p className="mt-1 text-sm text-slate-600">Date: {payment.payment_date}</p>
              </div>
            </header>

            <section className="grid gap-5 border-b border-slate-200 py-6 sm:grid-cols-2">
              <div><h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Received from</h2><p className="font-semibold text-slate-900">{studentName}</p><p className="text-sm text-slate-600">Admission No: {student.admission_number}</p></div>
              <div><h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Invoice details</h2><p className="font-semibold text-slate-900">{invoice.invoice_number}</p><p className="text-sm text-slate-600">Invoice date: {invoice.issue_date}</p>{invoice.due_date && <p className="text-sm text-slate-600">Due date: {invoice.due_date}</p>}</div>
            </section>

            <section className="py-6">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-slate-900">Payment allocation</h2><span className="text-xs uppercase tracking-wider text-slate-500">KES</span></div>
              <table className="w-full border-collapse text-sm"><thead><tr className="border-y border-slate-200 bg-slate-50 text-left text-slate-600"><th className="p-3">Votehead</th><th className="p-3">Code</th><th className="p-3 text-right">Amount paid</th></tr></thead><tbody>{lines.map((line, index) => <tr key={`${line.code}-${index}`} className="border-b border-slate-100"><td className="p-3 font-medium text-slate-800">{line.name}</td><td className="p-3 text-slate-600">{line.code}</td><td className="p-3 text-right font-medium">{money(line.amount)}</td></tr>)}</tbody><tfoot><tr className="border-t-2 border-slate-300"><td colSpan={2} className="p-3 text-right font-bold text-slate-900">Total received</td><td className="p-3 text-right text-lg font-extrabold text-emerald-800">{money(Number(payment.amount))}</td></tr></tfoot></table>
            </section>

            <section className="grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
              <div><p className="text-xs uppercase tracking-wider text-slate-500">Payment method</p><p className="mt-1 font-semibold capitalize text-slate-900">{payment.payment_method}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-slate-500">Transaction reference</p><p className="mt-1 break-words font-semibold text-slate-900">{payment.transaction_reference || 'Not provided'}</p></div>
              {payment.notes && <div className="sm:col-span-2"><p className="text-xs uppercase tracking-wider text-slate-500">Notes</p><p className="mt-1 text-sm text-slate-800">{payment.notes}</p></div>}
            </section>

            <footer className="mt-10 flex flex-col justify-between gap-6 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row"><p>This is a computer-generated receipt from {school.name}.</p><p>Thank you.</p></footer>
          </article>
        ) : null}
      </div>
    </div>
  );
}
