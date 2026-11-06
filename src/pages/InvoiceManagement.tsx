
import { useEffect, useMemo, useState } from 'react'
import {
  FileText,
  RefreshCw,
  Receipt,
  Wallet,
} from 'lucide-react'

import { supabase } from '../lib/supabase'

type InvoiceManagementProps = {
  schoolId: string
}

type Student = {
  id: string
  admission_number: string
  first_name: string
  middle_name: string | null
  last_name: string | null
}

type SchoolClass = {
  id: string
  class_name: string
}

type AcademicYear = {
  id: string
  year_name: string
}

type Enrollment = {
  id: string
  student_id: string
  class_id: string
  academic_year_id: string
  exit_date: string | null
}

type FeeStructure = {
  id: string
  structure_name: string
  class_id: string
  academic_year_id: string
  is_active: boolean
}

type Invoice = {
  id: string
  invoice_number: string
  student_id: string
  student_enrollment_id: string
  fee_structure_id: string
  issue_date: string
  due_date: string | null
  total_amount: number
  status: string
}

export default function InvoiceManagement({
  schoolId,
}: InvoiceManagementProps) {
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [years, setYears] = useState<AcademicYear[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])

  const [selectedEnrollment, setSelectedEnrollment] = useState('')
  const [selectedStructure, setSelectedStructure] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const selectedEnrollmentRecord = enrollments.find(
    (enrollment) => enrollment.id === selectedEnrollment
  )

  const availableStructures = useMemo(() => {
    if (!selectedEnrollmentRecord) return []

    return feeStructures.filter(
      (structure) =>
        structure.class_id === selectedEnrollmentRecord.class_id &&
        structure.academic_year_id ===
          selectedEnrollmentRecord.academic_year_id &&
        structure.is_active
    )
  }, [selectedEnrollmentRecord, feeStructures])

  useEffect(() => {
    loadData()
  }, [schoolId])

  async function loadData() {
    setLoading(true)
    setError('')

    const [
      studentsResult,
      classesResult,
      yearsResult,
      enrollmentsResult,
      structuresResult,
      invoicesResult,
    ] = await Promise.all([
      supabase
        .from('students')
        .select(
          'id, admission_number, first_name, middle_name, last_name'
        )
        .eq('school_id', schoolId)
        .order('first_name'),

      supabase
        .from('classes')
        .select('id, class_name')
        .eq('school_id', schoolId)
        .order('class_level'),

      supabase
        .from('academic_years')
        .select('id, year_name')
        .eq('school_id', schoolId)
        .order('year_name', { ascending: false }),

      supabase
        .from('student_enrollments')
        .select(
          'id, student_id, class_id, academic_year_id, exit_date'
        )
        .eq('school_id', schoolId)
        .is('exit_date', null),

      supabase
        .from('fee_structures')
        .select(
          'id, structure_name, class_id, academic_year_id, is_active'
        )
        .eq('school_id', schoolId)
        .eq('is_active', true),

      supabase
        .from('student_invoices')
        .select(
          'id, invoice_number, student_id, student_enrollment_id, fee_structure_id, issue_date, due_date, total_amount, status'
        )
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false }),
    ])

    const firstError =
      studentsResult.error ||
      classesResult.error ||
      yearsResult.error ||
      enrollmentsResult.error ||
      structuresResult.error ||
      invoicesResult.error

    if (firstError) {
      setError(firstError.message)
    } else {
      setStudents(studentsResult.data ?? [])
      setClasses(classesResult.data ?? [])
      setYears(yearsResult.data ?? [])
      setEnrollments(enrollmentsResult.data ?? [])
      setFeeStructures(structuresResult.data ?? [])
      setInvoices(invoicesResult.data ?? [])
    }

    setLoading(false)
  }

  function studentName(studentId: string) {
    const student = students.find((item) => item.id === studentId)

    if (!student) return 'Unknown student'

    return [
      student.first_name,
      student.middle_name,
      student.last_name,
    ]
      .filter(Boolean)
      .join(' ')
  }

  function enrollmentDescription(enrollment: Enrollment) {
    const student = students.find(
      (item) => item.id === enrollment.student_id
    )

    const schoolClass = classes.find(
      (item) => item.id === enrollment.class_id
    )

    const year = years.find(
      (item) => item.id === enrollment.academic_year_id
    )

    return `${studentName(enrollment.student_id)} — ${
      student?.admission_number ?? 'No admission number'
    } — ${schoolClass?.class_name ?? 'Unknown class'} — ${
      year?.year_name ?? 'Unknown year'
    }`
  }

  function formatKES(amount: number) {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      maximumFractionDigits: 2,
    }).format(amount)
  }

  async function generateInvoice(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (!selectedEnrollment || !selectedStructure) {
      setError('Select a student enrollment and fee structure.')
      return
    }

    setSaving(true)

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'generate_student_invoice',
        {
          p_school_id: schoolId,
          p_student_enrollment_id: selectedEnrollment,
          p_fee_structure_id: selectedStructure,
          p_due_date: dueDate || null,
          p_notes: notes.trim() || null,
        }
      )

      if (rpcError) throw rpcError

      const generatedInvoice = Array.isArray(data) ? data[0] : data

      if (!generatedInvoice?.invoice_id) {
        throw new Error('The invoice was not returned by the database.')
      }

      setSuccess(
        `Invoice ${generatedInvoice.invoice_number} generated successfully. Total: ${formatKES(
          Number(generatedInvoice.total_amount)
        )}`
      )

      setSelectedEnrollment('')
      setSelectedStructure('')
      setDueDate('')
      setNotes('')

      await loadData()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to generate invoice.'

      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const totalInvoiced = invoices.reduce(
    (total, invoice) => total + Number(invoice.total_amount),
    0
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="mr-2 animate-spin" />
        Loading invoices...
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Student Fee Invoicing
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Generate and manage student fee invoices.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <FileText className="text-emerald-700" size={23} />
          <p className="mt-3 text-sm text-gray-500">Total invoices</p>
          <p className="mt-1 text-2xl font-bold">{invoices.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <Wallet className="text-emerald-700" size={23} />
          <p className="mt-3 text-sm text-gray-500">Total invoiced</p>
          <p className="mt-1 text-xl font-bold">
            {formatKES(totalInvoiced)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <Receipt className="text-emerald-700" size={23} />
          <p className="mt-3 text-sm text-gray-500">
            Active enrollments
          </p>
          <p className="mt-1 text-2xl font-bold">
            {enrollments.length}
          </p>
        </div>
      </div>

      <form
        onSubmit={generateInvoice}
        className="space-y-6 rounded-xl border bg-white p-6"
      >
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Generate New Invoice
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Select an enrolled student and the matching class fee structure.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Student Enrollment *
          </label>

          <select
            value={selectedEnrollment}
            onChange={(event) => {
              setSelectedEnrollment(event.target.value)
              setSelectedStructure('')
            }}
            required
            className="w-full rounded-lg border border-gray-300 p-3"
          >
            <option value="">Select student enrollment</option>

            {enrollments.map((enrollment) => (
              <option key={enrollment.id} value={enrollment.id}>
                {enrollmentDescription(enrollment)}
              </option>
            ))}
          </select>

          {enrollments.length === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              No active student enrollments found. Register and enroll a student first.
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Matching Fee Structure *
          </label>

          <select
            value={selectedStructure}
            onChange={(event) =>
              setSelectedStructure(event.target.value)
            }
            required
            disabled={!selectedEnrollment}
            className="w-full rounded-lg border border-gray-300 p-3 disabled:bg-gray-100"
          >
            <option value="">Select fee structure</option>

            {availableStructures.map((structure) => (
              <option key={structure.id} value={structure.id}>
                {structure.structure_name}
              </option>
            ))}
          </select>

          {selectedEnrollment && availableStructures.length === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              No active fee structure matches this student's class and academic year.
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Due Date
          </label>

          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-lg border border-gray-300 p-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Notes
          </label>

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Optional invoice notes"
            className="w-full rounded-lg border border-gray-300 p-3"
          />
        </div>

        <button
          type="submit"
          disabled={
            saving ||
            !selectedEnrollment ||
            !selectedStructure
          }
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Receipt size={18} />
          {saving ? 'Generating invoice...' : 'Generate Invoice'}
        </button>
      </form>

      <section className="rounded-xl border bg-white p-6">
        <h3 className="mb-5 text-lg font-semibold text-gray-900">
          Invoice Directory
        </h3>

        {invoices.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">
            No invoices have been generated yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="p-3">Invoice</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Issue date</th>
                  <th className="p-3">Due date</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>

              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">
                      {invoice.invoice_number}
                    </td>
                    <td className="p-3">
                      {studentName(invoice.student_id)}
                    </td>
                    <td className="p-3">{invoice.issue_date}</td>
                    <td className="p-3">
                      {invoice.due_date ?? '—'}
                    </td>
                    <td className="p-3 font-medium">
                      {formatKES(Number(invoice.total_amount))}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                        {invoice.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
