import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

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
}

type Subject = {
  id: string
  subject_name: string
  subject_code: string | null
}

type Paper = {
  id: string
  school_id: string
  class_id: string
  subject_id: string
  academic_year_id: string
  term_id: string
  assessment_name: string
  assessment_type: string
  assessment_date: string | null
  maximum_marks: number
  stream_id: string | null
  exam_session_id: string | null
  paper_number: number | null
  paper_name: string | null
  weighting: number | null
}

type Props = {
  schoolId: string
  session: ExamSession
  onBack: () => void
}

type PaperForm = {
  subject_id: string
  paper_number: string
  paper_name: string
  maximum_marks: string
  weighting: string
  assessment_date: string
}

const emptyForm: PaperForm = {
  subject_id: '',
  paper_number: '1',
  paper_name: '',
  maximum_marks: '100',
  weighting: '',
  assessment_date: '',
}

function getErrorMessage(error: unknown) {
  const dbError = error as {
    message?: string
    details?: string
    hint?: string
    code?: string
  }

  return [
    dbError?.message || 'An unexpected error occurred.',
    dbError?.details,
    dbError?.hint,
    dbError?.code ? `Error code: ${dbError.code}` : null,
  ].filter(Boolean).join(' | ')
}

export default function ExaminationPapersManagement({
  schoolId,
  session,
  onBack,
}: Props) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PaperForm>(emptyForm)
  const [search, setSearch] = useState('')

  const isDraft = session.status === 'draft'

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [subjectsResult, papersResult] = await Promise.all([
        supabase
          .from('subjects')
          .select('id, subject_name, subject_code')
          .eq('school_id', schoolId)
          .order('subject_name'),

        supabase
          .from('assessments')
          .select(`
            id,
            school_id,
            class_id,
            subject_id,
            academic_year_id,
            term_id,
            assessment_name,
            assessment_type,
            assessment_date,
            maximum_marks,
            stream_id,
            exam_session_id,
            paper_number,
            paper_name,
            weighting
          `)
          .eq('school_id', schoolId)
          .eq('exam_session_id', session.id)
          .order('subject_id')
          .order('paper_number'),
      ])

      if (subjectsResult.error) throw subjectsResult.error
      if (papersResult.error) throw papersResult.error

      setSubjects((subjectsResult.data ?? []) as Subject[])
      setPapers((papersResult.data ?? []) as Paper[])
    } catch (err: unknown) {
      console.error('Paper data loading error:', err)
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [schoolId, session.id])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredPapers = useMemo(() => {
    const value = search.trim().toLowerCase()

    if (!value) return papers

    return papers.filter((paper) => {
      const subject = subjects.find((item) => item.id === paper.subject_id)
      return (
        (subject?.subject_name ?? '').toLowerCase().includes(value) ||
        (subject?.subject_code ?? '').toLowerCase().includes(value) ||
        (paper.paper_name ?? '').toLowerCase().includes(value) ||
        paper.assessment_name.toLowerCase().includes(value)
      )
    })
  }, [papers, subjects, search])

  const updateForm = (field: keyof PaperForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const openCreateForm = () => {
    setEditingId(null)
    setForm({
      ...emptyForm,
      assessment_date: session.start_date ?? '',
    })
    setError('')
    setSuccess('')
    setShowForm(true)
  }

  const openEditForm = (paper: Paper) => {
    setEditingId(paper.id)
    setForm({
      subject_id: paper.subject_id,
      paper_number: String(paper.paper_number ?? 1),
      paper_name: paper.paper_name ?? '',
      maximum_marks: String(paper.maximum_marks),
      weighting: paper.weighting === null ? '' : String(paper.weighting),
      assessment_date: paper.assessment_date ?? '',
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

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!isDraft) {
      setError('Papers can only be changed while the examination is in draft status.')
      return
    }

    const paperNumber = Number(form.paper_number)
    const maximumMarks = Number(form.maximum_marks)
    const weighting = form.weighting.trim() === ''
      ? null
      : Number(form.weighting)

    if (!form.subject_id) {
      setError('Please select a subject.')
      return
    }

    if (!Number.isInteger(paperNumber) || paperNumber < 1) {
      setError('Paper number must be a whole number greater than zero.')
      return
    }

    if (!Number.isFinite(maximumMarks) || maximumMarks <= 0) {
      setError('Maximum marks must be greater than zero.')
      return
    }

    if (
      weighting !== null &&
      (!Number.isFinite(weighting) || weighting <= 0)
    ) {
      setError('Weighting must be greater than zero, or left blank.')
      return
    }

    const duplicate = papers.find((paper) =>
      paper.id !== editingId &&
      paper.subject_id === form.subject_id &&
      paper.paper_number === paperNumber
    )

    if (duplicate) {
      setError('That paper number already exists for this subject in this examination.')
      return
    }

    const subject = subjects.find((item) => item.id === form.subject_id)

    if (!subject) {
      setError('The selected subject could not be found. Refresh and try again.')
      return
    }

    const paperName = form.paper_name.trim() ||
      `${subject.subject_name} Paper ${paperNumber}`

    const payload = {
      school_id: schoolId,
      class_id: session.class_id,
      subject_id: form.subject_id,
      academic_year_id: session.academic_year_id,
      term_id: session.term_id,
      assessment_name: `${subject.subject_name} - ${paperName}`,
      assessment_type: 'exam',
      assessment_date: form.assessment_date || null,
      maximum_marks: maximumMarks,
      stream_id: session.stream_id,
      exam_session_id: session.id,
      paper_number: paperNumber,
      paper_name: paperName,
      weighting,
    }

    setSaving(true)

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from('assessments')
          .update(payload)
          .eq('id', editingId)
          .eq('school_id', schoolId)
          .eq('exam_session_id', session.id)

        if (updateError) throw updateError
      } else {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) throw userError

        const { error: insertError } = await supabase
          .from('assessments')
          .insert({
            ...payload,
            created_by: user?.id ?? null,
          })

        if (insertError) throw insertError
      }

      closeForm()
      await loadData()
      setSuccess(
        editingId
          ? 'Examination paper updated successfully.'
          : 'Examination paper added successfully.',
      )
    } catch (err: unknown) {
      console.error('Paper save error:', err)
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (paper: Paper) => {
    if (!isDraft) {
      setError('Papers can only be deleted while the examination is in draft status.')
      return
    }

    const confirmed = window.confirm(
      `Delete "${paper.paper_name ?? paper.assessment_name}"?`,
    )

    if (!confirmed) return

    setError('')
    setSuccess('')

    try {
      const { count, error: countError } = await supabase
        .from('assessment_results')
        .select('id', { count: 'exact', head: true })
        .eq('assessment_id', paper.id)

      if (countError) throw countError

      if ((count ?? 0) > 0) {
        setError(
          'This paper already has student results. It cannot be deleted. Keep the paper and correct its details instead.',
        )
        return
      }

      const { error: deleteError } = await supabase
        .from('assessments')
        .delete()
        .eq('id', paper.id)
        .eq('school_id', schoolId)
        .eq('exam_session_id', session.id)

      if (deleteError) throw deleteError

      setPapers((current) => current.filter((item) => item.id !== paper.id))
      setSuccess('Examination paper deleted successfully.')
    } catch (err: unknown) {
      console.error('Paper deletion error:', err)
      setError(getErrorMessage(err))
    }
  }

  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find((item) => item.id === subjectId)
    if (!subject) return 'Unknown subject'
    return subject.subject_code
      ? `${subject.subject_name} (${subject.subject_code})`
      : subject.subject_name
  }

  const totalMaximumMarks = papers.reduce(
    (total, paper) => total + Number(paper.maximum_marks || 0),
    0,
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              className="mt-1 rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100"
              title="Back to examinations"
            >
              <ArrowLeft size={20} />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <BookOpen size={25} className="text-emerald-700" />
                <h1 className="text-2xl font-bold text-gray-900">
                  Examination Papers
                </h1>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {session.exam_name}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {isDraft
                  ? 'Draft examination — papers can be managed.'
                  : `This examination is ${session.status}. Paper changes are disabled.`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreateForm}
              disabled={!isDraft}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={18} />
              Add Paper
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Total papers</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{papers.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Subjects covered</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {new Set(papers.map((paper) => paper.subject_id)).size}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Combined maximum marks</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {totalMaximumMarks}
            </p>
          </div>
        </div>

        {showForm && (
          <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingId ? 'Edit Examination Paper' : 'Add Examination Paper'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Select a subject and configure the paper details.
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
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Subject *
                  </label>
                  <select
                    required
                    value={form.subject_id}
                    onChange={(event) => updateForm('subject_id', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="">Select subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.subject_code
                          ? `${subject.subject_name} (${subject.subject_code})`
                          : subject.subject_name}
                      </option>
                    ))}
                  </select>
                  {subjects.length === 0 && (
                    <p className="mt-1 text-xs text-red-600">
                      No subjects found. Add subjects to the school first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Paper number *
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={form.paper_number}
                    onChange={(event) => updateForm('paper_number', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Paper name
                  </label>
                  <input
                    value={form.paper_name}
                    onChange={(event) => updateForm('paper_name', event.target.value)}
                    placeholder="e.g. Algebra and Geometry"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Leave blank to use the subject and paper number.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Maximum marks *
                  </label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="any"
                    value={form.maximum_marks}
                    onChange={(event) => updateForm('maximum_marks', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Weighting
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={form.weighting}
                    onChange={(event) => updateForm('weighting', event.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Paper date
                  </label>
                  <input
                    type="date"
                    value={form.assessment_date}
                    onChange={(event) => updateForm('assessment_date', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

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
                  disabled={saving || subjects.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  <Save size={17} />
                  {saving ? 'Saving...' : editingId ? 'Update Paper' : 'Save Paper'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-bold text-gray-900">Papers in this examination</h2>
              <p className="mt-1 text-sm text-gray-500">
                {filteredPapers.length} paper{filteredPapers.length === 1 ? '' : 's'} found
              </p>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search papers or subjects..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm sm:max-w-xs"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 p-12 text-gray-500">
              <RefreshCw size={20} className="animate-spin" />
              <span className="text-sm">Loading examination papers...</span>
            </div>
          ) : filteredPapers.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
              <div className="rounded-full bg-gray-100 p-4">
                <ClipboardList size={30} className="text-gray-400" />
              </div>
              <h3 className="mt-4 font-semibold text-gray-800">No papers added yet</h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                Add the subjects and papers that make up this examination.
              </p>
              {isDraft && (
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  <Plus size={17} />
                  Add First Paper
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Subject</th>
                    <th className="px-5 py-4 font-semibold">Paper</th>
                    <th className="px-5 py-4 font-semibold">Paper name</th>
                    <th className="px-5 py-4 font-semibold">Maximum marks</th>
                    <th className="px-5 py-4 font-semibold">Weighting</th>
                    <th className="px-5 py-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPapers.map((paper) => (
                    <tr key={paper.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-medium text-gray-900">
                        {getSubjectName(paper.subject_id)}
                      </td>
                      <td className="px-5 py-4 text-gray-700">
                        Paper {paper.paper_number ?? '—'}
                      </td>
                      <td className="px-5 py-4 text-gray-700">
                        {paper.paper_name || paper.assessment_name}
                      </td>
                      <td className="px-5 py-4 font-semibold text-gray-900">
                        {paper.maximum_marks}
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {paper.weighting ?? '—'}
                      </td>
                      <td className="px-5 py-4">
                        {isDraft ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditForm(paper)}
                              title="Edit paper"
                              className="rounded-lg border border-gray-200 p-2 text-blue-600 hover:bg-blue-50"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(paper)}
                              title="Delete paper"
                              className="rounded-lg border border-gray-200 p-2 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Locked</span>
                        )}
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
