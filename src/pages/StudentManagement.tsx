import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  UserPlus,
  Search,
  Users,
  Loader2,
} from 'lucide-react'

type Student = {
  id: string
  admission_number: string
  first_name: string
  middle_name: string | null
  last_name: string | null
  enrollment_date: string
  status: string
}

type SchoolClass = {
  id: string
  class_name: string
}

type Stream = {
  id: string
  stream_name: string
}

type AcademicYear = {
  id: string
  year_name: string
  is_active: boolean
}

type Props = {
  schoolId: string
}

export default function StudentManagement({ schoolId }: Props) {
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')

  const [form, setForm] = useState({
    admission_number: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    enrollment_date: new Date().toISOString().slice(0, 10),
    class_id: '',
    stream_id: '',
    academic_year_id: '',
  })

  useEffect(() => {
    loadData()
  }, [schoolId])

  async function loadData() {
    setLoading(true)
    setMessage('')

    const [studentResult, classResult, yearResult] =
      await Promise.all([
        supabase
          .from('students')
          .select(
            'id, admission_number, first_name, middle_name, last_name, enrollment_date, status'
          )
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false }),

        supabase
          .from('classes')
          .select('id, class_name')
          .eq('school_id', schoolId)
          .order('class_level'),

        supabase
          .from('academic_years')
          .select('id, year_name, is_active')
          .eq('school_id', schoolId)
          .order('year_name'),
      ])

    if (studentResult.error) {
      setMessage(studentResult.error.message)
    } else {
      setStudents(studentResult.data ?? [])
    }

    if (classResult.error) {
      setMessage(classResult.error.message)
    } else {
      setClasses(classResult.data ?? [])
    }

    if (yearResult.error) {
      setMessage(yearResult.error.message)
    } else {
      const years = yearResult.data ?? []
      setAcademicYears(years)

      const activeYear = years.find(year => year.is_active)

      if (activeYear) {
        setForm(previous => ({
          ...previous,
          academic_year_id: activeYear.id,
        }))
      }
    }

    setLoading(false)
  }

  async function loadStreams(classId: string) {
    setForm(previous => ({
      ...previous,
      class_id: classId,
      stream_id: '',
    }))

    if (!classId) {
      setStreams([])
      return
    }

    const { data, error } = await supabase
      .from('streams')
      .select('id, stream_name')
      .eq('class_id', classId)
      .order('stream_name')

    if (error) {
      setMessage(error.message)
      return
    }

    setStreams(data ?? [])
  }

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm(previous => ({
      ...previous,
      [field]: value,
    }))
  }

  async function registerStudent(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      if (!form.admission_number.trim()) {
        throw new Error('Admission number is required.')
      }

      if (!form.first_name.trim()) {
        throw new Error('First name is required.')
      }

      if (!form.academic_year_id) {
        throw new Error('Please select an academic year.')
      }

      if (!form.class_id) {
        throw new Error('Please select a class.')
      }

      const { data: studentId, error } = await supabase.rpc(
        'register_student',
        {
          p_school_id: schoolId,
          p_admission_number: form.admission_number.trim(),
          p_first_name: form.first_name.trim(),
          p_middle_name: form.middle_name.trim() || null,
          p_last_name: form.last_name.trim() || null,
          p_date_of_birth: form.date_of_birth || null,
          p_gender: form.gender || null,
          p_enrollment_date: form.enrollment_date,
          p_academic_year_id: form.academic_year_id,
          p_class_id: form.class_id,
          p_stream_id: form.stream_id || null,
        }
      )

      if (error) throw error

      if (!studentId) {
        throw new Error('Registration did not return a student ID.')
      }

      setMessage('Student registered successfully!')

      setForm(previous => ({
        ...previous,
        admission_number: '',
        first_name: '',
        middle_name: '',
        last_name: '',
        date_of_birth: '',
        gender: '',
        class_id: '',
        stream_id: '',
      }))

      setStreams([])
      setShowForm(false)

      await loadData()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong.'
      )
    } finally {
      setSaving(false)
    }
  }

  const filteredStudents = students.filter(student => {
    const fullName = [
      student.first_name,
      student.middle_name,
      student.last_name,
    ].filter(Boolean).join(' ')

    return (
      fullName.toLowerCase().includes(search.toLowerCase()) ||
      student.admission_number.toLowerCase().includes(search.toLowerCase())
    )
  })

  return (
    <div className="min-h-screen bg-gray-50 p-5 md:p-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Student Management
            </h1>
            <p className="mt-1 text-gray-500">
              Register and manage your school's student records.
            </p>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-white hover:bg-emerald-800"
          >
            <UserPlus size={18} />
            Register student
          </button>
        </div>

        {message && (
          <div className="mb-5 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
            {message}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={registerStudent}
            className="mb-8 rounded-xl border bg-white p-6 shadow-sm"
          >
            <h2 className="mb-5 text-lg font-semibold">
              New student registration
            </h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

              <input
                required
                placeholder="Admission number"
                value={form.admission_number}
                onChange={e => updateField('admission_number', e.target.value)}
                className="rounded-lg border p-3"
              />

              <input
                required
                placeholder="First name"
                value={form.first_name}
                onChange={e => updateField('first_name', e.target.value)}
                className="rounded-lg border p-3"
              />

              <input
                placeholder="Middle name"
                value={form.middle_name}
                onChange={e => updateField('middle_name', e.target.value)}
                className="rounded-lg border p-3"
              />

              <input
                placeholder="Last name"
                value={form.last_name}
                onChange={e => updateField('last_name', e.target.value)}
                className="rounded-lg border p-3"
              />

              <label className="text-sm text-gray-600">
                Date of birth
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={e => updateField('date_of_birth', e.target.value)}
                  className="mt-1 w-full rounded-lg border p-3"
                />
              </label>

              <select
                value={form.gender}
                onChange={e => updateField('gender', e.target.value)}
                className="rounded-lg border p-3"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="not_specified">Prefer not to specify</option>
              </select>

              <label className="text-sm text-gray-600">
                Enrollment date
                <input
                  required
                  type="date"
                  value={form.enrollment_date}
                  onChange={e => updateField('enrollment_date', e.target.value)}
                  className="mt-1 w-full rounded-lg border p-3"
                />
              </label>

              <select
                required
                value={form.academic_year_id}
                onChange={e => updateField('academic_year_id', e.target.value)}
                className="rounded-lg border p-3"
              >
                <option value="">Select academic year</option>
                {academicYears.map(year => (
                  <option key={year.id} value={year.id}>
                    {year.year_name}{year.is_active ? ' (Active)' : ''}
                  </option>
                ))}
              </select>

              <select
                required
                value={form.class_id}
                onChange={e => loadStreams(e.target.value)}
                className="rounded-lg border p-3"
              >
                <option value="">Select class</option>
                {classes.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.class_name}
                  </option>
                ))}
              </select>

              <select
                value={form.stream_id}
                onChange={e => updateField('stream_id', e.target.value)}
                disabled={!form.class_id}
                className="rounded-lg border p-3"
              >
                <option value="">Select stream (optional)</option>
                {streams.map(stream => (
                  <option key={stream.id} value={stream.id}>
                    {stream.stream_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-white disabled:opacity-50"
              >
                {saving && <Loader2 size={18} className="animate-spin" />}
                {saving ? 'Saving...' : 'Save student'}
              </button>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border px-5 py-3"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-center gap-3">
              <Users className="text-emerald-700" />
              <span className="text-gray-500">Total students</span>
            </div>
            <p className="mt-3 text-3xl font-bold">
              {students.length}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-center gap-3">
              <Search className="text-emerald-700" />
              <span className="text-gray-500">Search records</span>
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or admission number"
              className="mt-3 w-full rounded-lg border p-2"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="p-4">Admission No.</th>
                <th className="p-4">Student name</th>
                <th className="p-4">Enrollment date</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center">
                    Loading students...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    No student records found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.id} className="border-t">
                    <td className="p-4 font-medium">
                      {student.admission_number}
                    </td>
                    <td className="p-4">
                      {[student.first_name, student.middle_name, student.last_name]
                        .filter(Boolean).join(' ')}
                    </td>
                    <td className="p-4">{student.enrollment_date}</td>
                    <td className="p-4">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                        {student.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}