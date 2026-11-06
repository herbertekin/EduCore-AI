import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  GraduationCap,
  Filter,
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import ExaminationPapersManagement from './ExaminationPapersManagement'

type AcademicYear = {
  id: string
  year_name: string
  start_date: string
  end_date: string
  is_active: boolean | null
}

type Term = {
  id: string
  academic_year_id: string
  term_number: number
  start_date: string
  end_date: string
}

type SchoolClass = {
  id: string
  class_name: string
  class_level: number
  curriculum: string
}

type Stream = {
  id: string
  class_id: string
  stream_name: string
}

type GradingScale = {
  id: string
  scale_name: string
  curriculum: string | null
  grade_level: string | null
  grading_mode: string
  is_default: boolean
}

type ExamSession = {
  id: string
  school_id: string
  academic_year_id: string
  term_id: string
  class_id: string
  stream_id: string | null
  exam_name: string
  exam_type: string
  start_date: string | null
  end_date: string | null
  status: string
  grading_scale_id: string | null
  created_at: string
}

type ExamForm = {
  academic_year_id: string
  term_id: string
  class_id: string
  stream_id: string
  exam_name: string
  exam_type: string
  start_date: string
  end_date: string
  status: string
  grading_scale_id: string
}

type Props = {
  schoolId: string
  schoolName: string
  onBack: () => void
}

const emptyForm: ExamForm = {
  academic_year_id: '',
  term_id: '',
  class_id: '',
  stream_id: '',
  exam_name: '',
  exam_type: 'End-Term Exam',
  start_date: '',
  end_date: '',
  status: 'draft',
  grading_scale_id: '',
}

const examTypes = [
  'CAT',
  'Mid-Term Exam',
  'End-Term Exam',
  'Mock Exam',
  'Final Exam',
  'Other',
]

const examStatuses = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'completed', label: 'Completed' },
]

function formatDate(date: string | null) {
  if (!date) return '—'

  return new Date(`${date}T00:00:00`).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getStatusLabel(status: string) {
  return (
    examStatuses.find((item) => item.value === status)?.label ??
    status
  )
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-700'
    case 'published':
      return 'bg-blue-100 text-blue-700'
    case 'draft':
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export default function ExaminationManagement({
  schoolId,
  schoolName,
  onBack,
}: Props) {
  const [sessions, setSessions] = useState<ExamSession[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [gradingScales, setGradingScales] = useState<GradingScale[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ExamForm>(emptyForm)

  // Selected examination session for paper management.
  const [selectedSession, setSelectedSession] =
    useState<ExamSession | null>(null)

  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [termFilter, setTermFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // --------------------------------------------------
  // LOAD EXAMINATION DATA
  // --------------------------------------------------

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [
        yearsResult,
        classesResult,
        gradingResult,
        sessionsResult,
      ] = await Promise.all([
        supabase
          .from('academic_years')
          .select('id, year_name, start_date, end_date, is_active')
          .eq('school_id', schoolId)
          .order('start_date', { ascending: false }),

        supabase
          .from('classes')
          .select('id, class_name, class_level, curriculum')
          .eq('school_id', schoolId)
          .order('class_level', { ascending: true }),

        supabase
          .from('grading_scales')
          .select(
            'id, scale_name, curriculum, grade_level, grading_mode, is_default',
          )
          .eq('school_id', schoolId)
          .order('scale_name'),

        supabase
          .from('exam_sessions')
          .select(
            'id, school_id, academic_year_id, term_id, class_id, stream_id, exam_name, exam_type, start_date, end_date, status, grading_scale_id, created_at',
          )
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false }),
      ])

      if (yearsResult.error) throw yearsResult.error
      if (classesResult.error) throw classesResult.error
      if (gradingResult.error) throw gradingResult.error
      if (sessionsResult.error) throw sessionsResult.error

      const years = (yearsResult.data ?? []) as AcademicYear[]
      const classRows = (classesResult.data ?? []) as SchoolClass[]

      setAcademicYears(years)
      setClasses(classRows)
      setGradingScales((gradingResult.data ?? []) as GradingScale[])
      setSessions((sessionsResult.data ?? []) as ExamSession[])

      if (years.length > 0) {
        const termsResult = await supabase
          .from('terms')
          .select(
            'id, academic_year_id, term_number, start_date, end_date',
          )
          .in(
            'academic_year_id',
            years.map((year) => year.id),
          )
          .order('term_number')

        if (termsResult.error) throw termsResult.error

        setTerms((termsResult.data ?? []) as Term[])
      } else {
        setTerms([])
      }

      if (classRows.length > 0) {
        const streamsResult = await supabase
          .from('streams')
          .select('id, class_id, stream_name')
          .in(
            'class_id',
            classRows.map((item) => item.id),
          )
          .order('stream_name')

        if (streamsResult.error) throw streamsResult.error

        setStreams((streamsResult.data ?? []) as Stream[])
      } else {
        setStreams([])
      }
    } catch (err: unknown) {
      console.error('Examination data loading error:', err)

      const dbError = err as {
        message?: string
        details?: string
        hint?: string
        code?: string
      }

      setError(
        [
          dbError?.message || 'Unable to load examination data.',
          dbError?.details,
          dbError?.hint,
          dbError?.code ? `Error code: ${dbError.code}` : null,
        ]
          .filter(Boolean)
          .join(' | '),
      )
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // --------------------------------------------------
  // FORM OPTIONS
  // --------------------------------------------------

  const availableTerms = useMemo(
    () =>
      terms.filter(
        (term) => term.academic_year_id === form.academic_year_id,
      ),
    [terms, form.academic_year_id],
  )

  const availableStreams = useMemo(
    () => streams.filter((stream) => stream.class_id === form.class_id),
    [streams, form.class_id],
  )

  // --------------------------------------------------
  // FILTER EXAMINATIONS
  // --------------------------------------------------

  const filteredSessions = useMemo(() => {
    const searchValue = search.trim().toLowerCase()

    return sessions.filter((session) => {
      const academicYear = academicYears.find(
        (year) => year.id === session.academic_year_id,
      )

      const schoolClass = classes.find(
        (item) => item.id === session.class_id,
      )

      const term = terms.find((item) => item.id === session.term_id)

      const matchesSearch =
        !searchValue ||
        session.exam_name.toLowerCase().includes(searchValue) ||
        session.exam_type.toLowerCase().includes(searchValue) ||
        (schoolClass?.class_name ?? '').toLowerCase().includes(searchValue)

      return (
        matchesSearch &&
        (!yearFilter || session.academic_year_id === yearFilter) &&
        (!termFilter || session.term_id === termFilter) &&
        (!classFilter || session.class_id === classFilter) &&
        (!statusFilter || session.status === statusFilter) &&
        (!yearFilter || academicYear?.id === yearFilter) &&
        (!termFilter || term?.id === termFilter)
      )
    })
  }, [
    sessions,
    academicYears,
    classes,
    terms,
    search,
    yearFilter,
    termFilter,
    classFilter,
    statusFilter,
  ])

  // --------------------------------------------------
  // FORM HELPERS
  // --------------------------------------------------

  const updateForm = <K extends keyof ExamForm>(
    field: K,
    value: ExamForm[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const openCreateForm = () => {
    const activeYear =
      academicYears.find((year) => year.is_active) ?? academicYears[0]

    setEditingId(null)

    setForm({
      ...emptyForm,
      academic_year_id: activeYear?.id ?? '',
    })

    setError('')
    setSuccess('')
    setShowForm(true)
  }

  const openEditForm = (session: ExamSession) => {
    setEditingId(session.id)

    setForm({
      academic_year_id: session.academic_year_id,
      term_id: session.term_id,
      class_id: session.class_id,
      stream_id: session.stream_id ?? '',
      exam_name: session.exam_name,
      exam_type: session.exam_type,
      start_date: session.start_date ?? '',
      end_date: session.end_date ?? '',
      status: session.status,
      grading_scale_id: session.grading_scale_id ?? '',
    })

    setError('')
    setSuccess('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  // --------------------------------------------------
  // SAVE EXAMINATION
  // --------------------------------------------------

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setError('')
    setSuccess('')

    const wasEditing = Boolean(editingId)

    if (
      !form.academic_year_id ||
      !form.term_id ||
      !form.class_id ||
      !form.exam_name.trim()
    ) {
      setError('Please complete all required fields.')
      return
    }

    if (
      form.start_date &&
      form.end_date &&
      form.end_date < form.start_date
    ) {
      setError('The end date cannot be earlier than the start date.')
      return
    }

    const selectedTerm = terms.find(
      (term) => term.id === form.term_id,
    )

    if (
      !selectedTerm ||
      selectedTerm.academic_year_id !== form.academic_year_id
    ) {
      setError('Please select a valid term for the selected academic year.')
      return
    }

    const allowedStatuses = ['draft', 'published', 'completed']

    if (!allowedStatuses.includes(form.status)) {
      setError('Please select a valid examination status.')
      return
    }

    setSaving(true)

    const payload = {
      school_id: schoolId,
      academic_year_id: form.academic_year_id,
      term_id: form.term_id,
      class_id: form.class_id,
      stream_id: form.stream_id || null,
      exam_name: form.exam_name.trim(),
      exam_type: form.exam_type,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status,
      grading_scale_id: form.grading_scale_id || null,
    }

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from('exam_sessions')
          .update(payload)
          .eq('id', editingId)
          .eq('school_id', schoolId)

        if (updateError) throw updateError
      } else {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError

        const { error: insertError } = await supabase
          .from('exam_sessions')
          .insert({
            ...payload,
            created_by: user?.id ?? null,
          })

        if (insertError) throw insertError
      }

      closeForm()

      await loadData()

      setSuccess(
        wasEditing
          ? 'Examination session updated successfully.'
          : 'Examination session created successfully.',
      )
    } catch (err: unknown) {
      console.error('Examination save error:', err)

      const dbError = err as {
        message?: string
        details?: string
        hint?: string
        code?: string
      }

      const errorMessage = [
        dbError?.message || 'Unable to save examination session.',
        dbError?.details,
        dbError?.hint,
        dbError?.code ? `Error code: ${dbError.code}` : null,
      ]
        .filter(Boolean)
        .join(' | ')

      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  // --------------------------------------------------
  // DELETE EXAMINATION
  // --------------------------------------------------

  const handleDelete = async (session: ExamSession) => {
    const confirmed = window.confirm(
      `Delete "${session.exam_name}"? This action cannot be undone.`,
    )

    if (!confirmed) return

    setError('')
    setSuccess('')

    try {
      const { error: deleteError } = await supabase
        .from('exam_sessions')
        .delete()
        .eq('id', session.id)
        .eq('school_id', schoolId)

      if (deleteError) throw deleteError

      setSessions((current) =>
        current.filter((item) => item.id !== session.id),
      )

      setSuccess('Examination session deleted successfully.')
    } catch (err: unknown) {
      console.error('Examination deletion error:', err)

      const dbError = err as {
        message?: string
        details?: string
        hint?: string
        code?: string
      }

      setError(
        [
          dbError?.message ||
            'Unable to delete examination session. Check whether papers are linked to it.',
          dbError?.details,
          dbError?.hint,
          dbError?.code ? `Error code: ${dbError.code}` : null,
        ]
          .filter(Boolean)
          .join(' | '),
      )
    }
  }

  // --------------------------------------------------
  // DISPLAY HELPERS
  // --------------------------------------------------

  const getYearName = (id: string) =>
    academicYears.find((year) => year.id === id)?.year_name ?? 'Unknown year'

  const getTermName = (id: string) => {
    const term = terms.find((item) => item.id === id)
    return term ? `Term ${term.term_number}` : 'Unknown term'
  }

  const getClassName = (id: string) =>
    classes.find((item) => item.id === id)?.class_name ?? 'Unknown class'

  const getStreamName = (id: string | null) => {
    if (!id) return 'All streams'

    return (
      streams.find((stream) => stream.id === id)?.stream_name ??
      'Unknown stream'
    )
  }

  const getGradingScaleName = (id: string | null) => {
    if (!id) return 'Default grading'

    return (
      gradingScales.find((scale) => scale.id === id)?.scale_name ??
      'Unknown grading scale'
    )
  }

  // --------------------------------------------------
  // OPEN PAPER MANAGEMENT
  // --------------------------------------------------

  if (selectedSession) {
    return (
      <ExaminationPapersManagement
        schoolId={schoolId}
        session={selectedSession}
        onBack={() => {
          setSelectedSession(null)
          void loadData()
        }}
      />
    )
  }

  // --------------------------------------------------
  // USER INTERFACE
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* PAGE HEADER */}

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              className="mt-1 rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100"
              title="Back to dashboard"
            >
              <ArrowLeft size={20} />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <GraduationCap className="text-emerald-700" size={25} />

                <h1 className="text-2xl font-bold text-gray-900">
                  Examination Management
                </h1>
              </div>

              <p className="mt-1 text-sm text-gray-500">
                Manage examination sessions for {schoolName}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? 'animate-spin' : ''}
              />

              Refresh
            </button>

            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              <Plus size={18} />
              Create Examination
            </button>
          </div>
        </div>

        {/* ERROR MESSAGE */}

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        )}

        {/* SUCCESS MESSAGE */}

        {success && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {/* SUMMARY CARDS */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                Total examinations
              </p>

              <ClipboardList className="text-emerald-700" size={22} />
            </div>

            <p className="mt-3 text-3xl font-bold text-gray-900">
              {sessions.length}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                Published
              </p>

              <CalendarDays className="text-blue-600" size={22} />
            </div>

            <p className="mt-3 text-3xl font-bold text-gray-900">
              {sessions.filter((item) => item.status === 'published').length}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                Draft
              </p>

              <BookOpen className="text-gray-600" size={22} />
            </div>

            <p className="mt-3 text-3xl font-bold text-gray-900">
              {sessions.filter((item) => item.status === 'draft').length}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                Completed
              </p>

              <CheckCircle2 className="text-green-600" size={22} />
            </div>

            <p className="mt-3 text-3xl font-bold text-gray-900">
              {sessions.filter((item) => item.status === 'completed').length}
            </p>
          </div>

        </div>

        {/* CREATE / EDIT FORM */}

        {showForm && (
          <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingId
                    ? 'Edit Examination Session'
                    : 'Create Examination Session'}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Fields marked with * are required.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                title="Close form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

                {/* EXAMINATION NAME */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Examination name *
                  </label>

                  <input
                    required
                    value={form.exam_name}
                    onChange={(event) =>
                      updateForm('exam_name', event.target.value)
                    }
                    placeholder="e.g. Term 2 End-Term Examination"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                {/* EXAMINATION TYPE */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Examination type *
                  </label>

                  <select
                    required
                    value={form.exam_type}
                    onChange={(event) =>
                      updateForm('exam_type', event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
                  >
                    {examTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* STATUS */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Status *
                  </label>

                  <select
                    required
                    value={form.status}
                    onChange={(event) =>
                      updateForm('status', event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
                  >
                    {examStatuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ACADEMIC YEAR */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Academic year *
                  </label>

                  <select
                    required
                    value={form.academic_year_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        academic_year_id: event.target.value,
                        term_id: '',
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
                  >
                    <option value="">Select academic year</option>

                    {academicYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.year_name}
                        {year.is_active ? ' (Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* TERM */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Term *
                  </label>

                  <select
                    required
                    value={form.term_id}
                    onChange={(event) =>
                      updateForm('term_id', event.target.value)
                    }
                    disabled={!form.academic_year_id}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 disabled:bg-gray-100"
                  >
                    <option value="">Select term</option>

                    {availableTerms.map((term) => (
                      <option key={term.id} value={term.id}>
                        Term {term.term_number}
                      </option>
                    ))}
                  </select>
                </div>

                {/* CLASS */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Class *
                  </label>

                  <select
                    required
                    value={form.class_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        class_id: event.target.value,
                        stream_id: '',
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
                  >
                    <option value="">Select class</option>

                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.class_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* STREAM */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Stream
                  </label>

                  <select
                    value={form.stream_id}
                    onChange={(event) =>
                      updateForm('stream_id', event.target.value)
                    }
                    disabled={!form.class_id}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 disabled:bg-gray-100"
                  >
                    <option value="">All streams</option>

                    {availableStreams.map((stream) => (
                      <option key={stream.id} value={stream.id}>
                        {stream.stream_name}
                      </option>
                    ))}
                  </select>

                  <p className="mt-1 text-xs text-gray-500">
                    Leave blank to target the whole class.
                  </p>
                </div>

                {/* START DATE */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Start date
                  </label>

                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(event) =>
                      updateForm('start_date', event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
                  />
                </div>

                {/* END DATE */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    End date
                  </label>

                  <input
                    type="date"
                    value={form.end_date}
                    min={form.start_date || undefined}
                    onChange={(event) =>
                      updateForm('end_date', event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
                  />
                </div>

                {/* GRADING SCALE */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Grading scale
                  </label>

                  <select
                    value={form.grading_scale_id}
                    onChange={(event) =>
                      updateForm('grading_scale_id', event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
                  >
                    <option value="">Use default / decide later</option>

                    {gradingScales.map((scale) => (
                      <option key={scale.id} value={scale.id}>
                        {scale.scale_name}
                        {scale.is_default ? ' (Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              {/* FORM ACTIONS */}

              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-5">

                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  <Save size={17} />

                  {saving
                    ? 'Saving...'
                    : editingId
                      ? 'Update Examination'
                      : 'Create Examination'}
                </button>

              </div>
            </form>
          </div>
        )}

        {/* FILTERS */}

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">

          <div className="mb-4 flex items-center gap-2">
            <Filter size={18} className="text-gray-500" />

            <h2 className="font-semibold text-gray-800">
              Filter examinations
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">

            {/* SEARCH */}

            <div className="relative lg:col-span-1">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search examinations..."
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-600"
              />
            </div>

            {/* YEAR FILTER */}

            <select
              value={yearFilter}
              onChange={(event) => {
                setYearFilter(event.target.value)
                setTermFilter('')
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
            >
              <option value="">All academic years</option>

              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.year_name}
                </option>
              ))}
            </select>

            {/* TERM FILTER */}

            <select
              value={termFilter}
              onChange={(event) => setTermFilter(event.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
            >
              <option value="">All terms</option>

              {terms
                .filter(
                  (term) =>
                    !yearFilter ||
                    term.academic_year_id === yearFilter,
                )
                .map((term) => (
                  <option key={term.id} value={term.id}>
                    {getYearName(term.academic_year_id)} - Term{' '}
                    {term.term_number}
                  </option>
                ))}
            </select>

            {/* CLASS FILTER */}

            <select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
            >
              <option value="">All classes</option>

              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.class_name}
                </option>
              ))}
            </select>

            {/* STATUS FILTER */}

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
            >
              <option value="">All statuses</option>

              {examStatuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

          </div>
        </div>

        {/* EXAMINATION TABLE */}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="flex flex-col justify-between gap-2 border-b border-gray-100 p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-bold text-gray-900">
                Examination Sessions
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {filteredSessions.length} examination
                {filteredSessions.length === 1 ? '' : 's'} found
              </p>
            </div>
          </div>

          {/* LOADING */}

          {loading ? (
            <div className="flex items-center justify-center gap-3 p-12 text-gray-500">
              <RefreshCw size={20} className="animate-spin" />

              <span className="text-sm">
                Loading examination sessions...
              </span>
            </div>
          ) : filteredSessions.length === 0 ? (

            /* EMPTY STATE */

            <div className="flex flex-col items-center justify-center px-5 py-14 text-center">

              <div className="rounded-full bg-gray-100 p-4">
                <ClipboardList size={30} className="text-gray-400" />
              </div>

              <h3 className="mt-4 font-semibold text-gray-800">
                No examinations found
              </h3>

              <p className="mt-1 max-w-md text-sm text-gray-500">
                Create an examination session or adjust your search filters.
              </p>

              <button
                type="button"
                onClick={openCreateForm}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                <Plus size={17} />
                Create Examination
              </button>

            </div>
          ) : (

            /* TABLE */

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">

                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">
                      Examination
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Academic period
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Class / Stream
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Dates
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Grading scale
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Status
                    </th>

                    <th className="px-5 py-4 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">

                  {filteredSessions.map((session) => (
                    <tr
                      key={session.id}
                      className="transition hover:bg-gray-50"
                    >

                      {/* EXAMINATION */}

                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">
                          {session.exam_name}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {session.exam_type}
                        </p>
                      </td>

                      {/* ACADEMIC PERIOD */}

                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-800">
                          {getYearName(session.academic_year_id)}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {getTermName(session.term_id)}
                        </p>
                      </td>

                      {/* CLASS AND STREAM */}

                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-800">
                          {getClassName(session.class_id)}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {getStreamName(session.stream_id)}
                        </p>
                      </td>

                      {/* DATES */}

                      <td className="px-5 py-4 text-gray-600">
                        <p>{formatDate(session.start_date)}</p>

                        <p className="mt-1 text-xs text-gray-400">
                          to {formatDate(session.end_date)}
                        </p>
                      </td>

                      {/* GRADING SCALE */}

                      <td className="px-5 py-4 text-gray-600">
                        {getGradingScaleName(session.grading_scale_id)}
                      </td>

                      {/* STATUS */}

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyle(session.status)}`}
                        >
                          {getStatusLabel(session.status)}
                        </span>
                      </td>

                      {/* ACTIONS */}

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">

                          <button
                            type="button"
                            onClick={() => setSelectedSession(session)}
                            title="Manage examination papers"
                            className="rounded-lg border border-gray-200 p-2 text-emerald-600 hover:bg-emerald-50"
                          >
                            <BookOpen size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditForm(session)}
                            title="Edit examination"
                            className="rounded-lg border border-gray-200 p-2 text-blue-600 hover:bg-blue-50"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDelete(session)}
                            title="Delete examination"
                            className="rounded-lg border border-gray-200 p-2 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>

                        </div>
                      </td>

                    </tr>
                  ))}

                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
