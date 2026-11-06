
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Banknote,
  Receipt,
  Search,
  Wallet,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import PaymentReceipt from './PaymentReceipt';

type PaymentMethod = 'cash' | 'bank' | 'mpesa';

type Student = {
  id: string;
  admission_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
};

type Invoice = {
  id: string;
  student_id: string;
  invoice_number: string;
  total_amount: number;
  status: string;
  issue_date: string;
  due_date: string | null;
};

type InvoiceItem = {
  id: string;
  invoice_id: string;
  votehead_code: string;
  votehead_name: string;
  amount: number;
};

type PaymentItem = InvoiceItem & {
  paid: number;
  balance: number;
  allocation: number;
};

type PaymentResult = {
  success: boolean;
  payment_id: string;
  receipt_number: string;
  amount: number;
  invoice_status: string;
};

type PaymentManagementProps = {
  schoolId: string;
};

export default function PaymentManagement({
  schoolId,
}: PaymentManagementProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<PaymentItem[]>([]);

  const [studentId, setStudentId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('cash');

  const [amount, setAmount] = useState('');
  const [transactionReference, setTransactionReference] =
    useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<PaymentResult | null>(null);
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);

  const [paymentHistory, setPaymentHistory] = useState<
    {
      id: string;
      receipt_number: string;
      amount: number;
      payment_method: string;
      payment_date: string;
      transaction_reference: string | null;
    }[]
  >([]);

  const formatMoney = (value: number) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(value);

  const studentName = (student: Student) =>
    [
      student.first_name,
      student.middle_name,
      student.last_name,
    ]
      .filter(Boolean)
      .join(' ');

  const selectedStudent = students.find(
    (student) => student.id === studentId
  );

  const selectedInvoice = invoices.find(
    (invoice) => invoice.id === invoiceId
  );

  const availableInvoices = invoices.filter(
    (invoice) =>
      invoice.student_id === studentId &&
      ['issued', 'partially_paid'].includes(invoice.status)
  );

  const numericAmount = Number(amount || 0);

  const totalOutstanding = items.reduce(
    (sum, item) => sum + item.balance,
    0
  );

  const filteredStudents = students.filter((student) => {
    const query = search.toLowerCase();

    return (
      studentName(student).toLowerCase().includes(query) ||
      student.admission_number.toLowerCase().includes(query)
    );
  });

  // Derive allocations from the latest amount AND the loaded invoice items.
  // This also handles entering an amount while invoice items are still loading.
  const allocationItems = useMemo(() => {
    let remaining = Number.isFinite(numericAmount)
      ? Math.max(0, numericAmount)
      : 0;

    return items.map((item) => {
      const allocation = Math.min(item.balance, remaining);
      remaining = Math.max(0, remaining - allocation);
      return { ...item, allocation };
    });
  }, [items, numericAmount]);

  const totalAllocated = allocationItems.reduce(
    (sum, item) => sum + item.allocation,
    0
  );

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [studentResponse, invoiceResponse, historyResponse] =
        await Promise.all([
          supabase
            .from('students')
            .select(
              'id, admission_number, first_name, middle_name, last_name'
            )
            .eq('school_id', schoolId)
            .order('first_name'),

          supabase
            .from('student_invoices')
            .select(
              'id, student_id, invoice_number, total_amount, status, issue_date, due_date'
            )
            .eq('school_id', schoolId)
            .in('status', ['issued', 'partially_paid'])
            .order('issue_date', { ascending: false }),

          supabase
            .from('student_payments')
            .select(
              'id, receipt_number, amount, payment_method, payment_date, transaction_reference'
            )
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(20),
        ]);

      if (studentResponse.error) throw studentResponse.error;
      if (invoiceResponse.error) throw invoiceResponse.error;
      if (historyResponse.error) throw historyResponse.error;

      setStudents(studentResponse.data || []);
      setInvoices(invoiceResponse.data || []);
      setPaymentHistory(historyResponse.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load payment data.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [schoolId]);

  const loadInvoiceItems = async (selectedInvoiceId: string) => {
    setItems([]);
    setAmount('');
    setError('');

    if (!selectedInvoiceId) return;

    setLoadingItems(true);

    try {
      const { data: invoiceItems, error: itemError } = await supabase
        .from('student_invoice_items')
        .select(
          'id, invoice_id, votehead_code, votehead_name, amount'
        )
        .eq('invoice_id', selectedInvoiceId)
        .eq('school_id', schoolId);

      if (itemError) throw itemError;

      const itemIds = (invoiceItems || []).map((item) => item.id);

      let allocations: {
        invoice_item_id: string;
        amount: number;
      }[] = [];

      if (itemIds.length > 0) {
        const { data, error: allocationError } = await supabase
          .from('payment_allocations')
          .select('invoice_item_id, amount')
          .eq('school_id', schoolId)
          .in('invoice_item_id', itemIds);

        if (allocationError) throw allocationError;
        allocations = data || [];
      }

      const paymentItems: PaymentItem[] = (invoiceItems || []).map(
        (item) => {
          const paid = allocations
            .filter((allocation) => allocation.invoice_item_id === item.id)
            .reduce(
              (sum, allocation) => sum + Number(allocation.amount),
              0
            );

          const itemAmount = Number(item.amount);

          return {
            ...item,
            amount: itemAmount,
            paid,
            balance: Math.max(0, itemAmount - paid),
            allocation: 0,
          };
        }
      );

      setItems(paymentItems);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load invoice items.'
      );
    } finally {
      setLoadingItems(false);
    }
  };

  // Allocations are calculated by allocationItems, so the amount can be
  // entered before or after invoice items finish loading.
  const handleAmountChange = (value: string) => {
    setAmount(value);
  };

  const handleStudentChange = (value: string) => {
    setStudentId(value);
    setInvoiceId('');
    setItems([]);
    setAmount('');
    setSuccess(null);
    setError('');
  };

  const handleInvoiceChange = (value: string) => {
    setInvoiceId(value);
    void loadInvoiceItems(value);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError('');
    setSuccess(null);

    if (!studentId || !invoiceId) {
      setError('Select a student and invoice.');
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Enter a valid payment amount.');
      return;
    }

    if (numericAmount > totalOutstanding) {
      setError('Payment cannot exceed the outstanding invoice balance.');
      return;
    }

    if (Math.abs(totalAllocated - numericAmount) > 0.001) {
      setError('The payment must be fully allocated to invoice items.');
      return;
    }

    if (
      (paymentMethod === 'mpesa' || paymentMethod === 'bank') &&
      !transactionReference.trim()
    ) {
      setError('Enter the transaction reference for this payment.');
      return;
    }

    const allocations = allocationItems
      .filter((item) => item.allocation > 0)
      .map((item) => ({
        invoice_item_id: item.id,
        amount: Number(item.allocation.toFixed(2)),
      }));

    setSaving(true);

    try {
      const { data, error: paymentError } = await supabase.rpc(
        'record_student_payment',
        {
          p_school_id: schoolId,
          p_student_id: studentId,
          p_invoice_id: invoiceId,
          p_payment_method: paymentMethod,
          p_amount: Number(numericAmount.toFixed(2)),
          p_allocations: allocations,
          p_transaction_reference:
            transactionReference.trim() || null,
          p_payment_date: paymentDate,
          p_notes: notes.trim() || null,
        }
      );

      if (paymentError) throw paymentError;

      const result = data as PaymentResult;

      setSuccess(result);
      setAmount('');
      setTransactionReference('');
      setNotes('');
      setItems([]);

      await loadData();
      await loadInvoiceItems(invoiceId);
      // Reloading invoice items clears prior notices; restore the receipt confirmation.
      setSuccess(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not record payment.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-slate-500">
        <RefreshCw className="h-5 w-5 animate-spin" />
        Loading payment records...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Student Payments
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Record payments and allocate them to outstanding invoices.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Students</p>
            <Wallet className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-3 text-2xl font-bold">{students.length}</p>
          <p className="mt-1 text-xs text-slate-500">
            Registered students
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Outstanding invoices</p>
            <Banknote className="h-5 w-5 text-amber-600" />
          </div>
          <p className="mt-3 text-2xl font-bold">{invoices.length}</p>
          <p className="mt-1 text-xs text-slate-500">
            Issued or partially paid
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Recent payments</p>
            <Receipt className="h-5 w-5 text-blue-600" />
          </div>
          <p className="mt-3 text-2xl font-bold">
            {paymentHistory.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Latest 20 transactions
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 font-semibold text-emerald-800">
            <CheckCircle className="h-5 w-5" />
            Payment recorded successfully
          </div>
          <div className="mt-3 grid gap-2 text-sm text-emerald-900 sm:grid-cols-3">
            <p>
              Receipt: <strong>{success.receipt_number}</strong>
            </p>
            <p>
              Amount: <strong>{formatMoney(Number(success.amount))}</strong>
            </p>
            <p>
              Invoice status: <strong>{success.invoice_status}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReceiptPaymentId(success.payment_id)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            <Receipt className="h-4 w-4" /> View / Print Receipt
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Record a payment
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Select an outstanding invoice and enter the amount received.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Search student
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name or admission number"
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-600"
                />
              </div>

              <select
                value={studentId}
                onChange={(event) => handleStudentChange(event.target.value)}
                className="mt-3 w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                required
              >
                <option value="">Select student</option>
                {filteredStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {studentName(student)} — {student.admission_number}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Outstanding invoice
              </label>
              <select
                value={invoiceId}
                onChange={(event) => handleInvoiceChange(event.target.value)}
                disabled={!studentId}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm disabled:bg-slate-100"
                required
              >
                <option value="">Select invoice</option>
                {availableInvoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} —{' '}
                    {formatMoney(Number(invoice.total_amount))}
                  </option>
                ))}
              </select>

              {selectedInvoice && (
                <p className="mt-2 text-xs text-slate-500">
                  Issued: {selectedInvoice.issue_date} · Status:{' '}
                  {selectedInvoice.status}
                </p>
              )}
            </div>
          </div>

          {selectedStudent && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <strong>{studentName(selectedStudent)}</strong>
              <span className="ml-2 text-slate-500">
                Admission: {selectedStudent.admission_number}
              </span>
            </div>
          )}

          {loadingItems && (
            <p className="text-sm text-slate-500">
              Loading invoice items...
            </p>
          )}

          {invoiceId && !loadingItems && items.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No invoice items were found for this invoice. Check that the invoice
              has fee-structure items before recording a payment.
            </p>
          )}

          {items.length > 0 && (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-800">
                  Invoice item balances
                </h3>
                <span className="text-sm font-semibold text-amber-700">
                  Outstanding: {formatMoney(totalOutstanding)}
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3">Votehead</th>
                      <th className="p-3 text-right">Billed</th>
                      <th className="p-3 text-right">Paid</th>
                      <th className="p-3 text-right">Balance</th>
                      <th className="p-3 text-right">Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocationItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="p-3">
                          <p className="font-medium">{item.votehead_name}</p>
                          <p className="text-xs text-slate-500">
                            {item.votehead_code}
                          </p>
                        </td>
                        <td className="p-3 text-right">
                          {formatMoney(item.amount)}
                        </td>
                        <td className="p-3 text-right">
                          {formatMoney(item.paid)}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {formatMoney(item.balance)}
                        </td>
                        <td className="p-3 text-right text-emerald-700">
                          {formatMoney(item.allocation)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                The entered payment is automatically allocated to the
                outstanding voteheads in the order shown.
              </p>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Payment method
              </label>
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as PaymentMethod)
                }
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="mpesa">M-Pesa</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Amount received (KES)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => handleAmountChange(event.target.value)}
                placeholder="e.g. 5000"
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                required
              />
            </div>

            {(paymentMethod === 'mpesa' || paymentMethod === 'bank') && (
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Transaction reference
                </label>
                <input
                  value={transactionReference}
                  onChange={(event) =>
                    setTransactionReference(event.target.value)
                  }
                  placeholder="Enter transaction reference"
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                  required
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium">
                Payment date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                placeholder="Additional payment details..."
                className="w-full rounded-lg border border-slate-300 p-3 text-sm"
              />
            </div>
          </div>

          {amount && (
            <div className="rounded-lg bg-emerald-50 p-4 text-sm">
              <div className="flex justify-between">
                <span>Payment entered</span>
                <strong>{formatMoney(numericAmount)}</strong>
              </div>
              <div className="mt-2 flex justify-between">
                <span>Amount allocated</span>
                <strong>{formatMoney(totalAllocated)}</strong>
              </div>
              <div className="mt-2 flex justify-between border-t border-emerald-200 pt-2">
                <span>Remaining to allocate</span>
                <strong>
                  {formatMoney(Math.max(0, numericAmount - totalAllocated))}
                </strong>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={
              saving ||
              !invoiceId ||
              items.length === 0 ||
              loadingItems ||
              !Number.isFinite(numericAmount) ||
              numericAmount <= 0 ||
              numericAmount > totalOutstanding ||
              Math.abs(totalAllocated - numericAmount) > 0.001
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <Receipt className="h-4 w-4" />
            {saving ? 'Recording payment...' : 'Record payment'}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Recent payment history</h2>
        <p className="mt-1 text-sm text-slate-500">
          Latest 20 recorded payments.
        </p>

        {paymentHistory.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No payments have been recorded yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Receipt</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Reference</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((payment) => (
                  <tr key={payment.id} className="border-t border-slate-100">
                    <td className="p-3 font-medium">
                      {payment.receipt_number}
                    </td>
                    <td className="p-3">{payment.payment_date}</td>
                    <td className="p-3 capitalize">
                      {payment.payment_method}
                    </td>
                    <td className="p-3">
                      {payment.transaction_reference || '—'}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatMoney(Number(payment.amount))}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setReceiptPaymentId(payment.id)}
                        className="whitespace-nowrap rounded-md border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                      >
                        View receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {receiptPaymentId && (
        <PaymentReceipt
          paymentId={receiptPaymentId}
          schoolId={schoolId}
          onClose={() => setReceiptPaymentId(null)}
        />
      )}
    </div>
  );
}
