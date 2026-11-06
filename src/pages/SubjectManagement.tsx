import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Subject = {
  id: string
  school_id: string
  subject_code: string
  subject_name: string
}

type SchoolClass = {
  id: string
  class_name: string
}

type ClassSubject = {
  id: string
  class_id: string
  subject_id: string
}

type Props = {
  schoolId: string
}

export default function SubjectManagement({ schoolId }: Props) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [assignments, setAssignments] = useState<ClassSubject[]>([])

  const [subjectCode, setSubjectCode] = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    const [
      { data: subjectData, error: subjectError },
      { data: classData, error: classError },
      { data: assignmentData, error: assignmentError },
    ] = await Promise.all([
      supabase
        .from('subjects')
        .select('id, school_id, subject_code, subject_name')
        .eq('school_id', schoolId)
        .order('subject_name'),

      supabase
        .from('classes')
        .select('id, class_name')
        .eq('school_id', schoolId)
        .order('class_level'),

      supabase
        .from('class_subjects')
        .select('id, class_id, subject_id')
        .eq('school_id', schoolId),
    ])

    if (subjectError || classError || assignmentError) {
      setErrorMessage(
        subjectError?.message ||
        classError?.message ||
        assignmentError?.message ||
        'Could not load academic data.'
      )
    } else {
      setSubjects((subjectData ?? []) as Subject[])
      setClasses((classData ?? []) as SchoolClass[])
      setAssignments((assignmentData ?? []) as ClassSubject[])
    }

    setLoading(false)
  }, [schoolId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const addSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setErrorMessage('')

    const { error } = await supabase
      .from('subjects')
      .insert({
        school_id: schoolId,
        subject_code: subjectCode.trim().toUpperCase(),
        subject_name: subjectName.trim(),
      })

    if (error) {
      setErrorMessage(error.message)
    } else {
      setMessage('Subject added successfully.')
      setSubjectCode('')
      setSubjectName('')
      await loadData()
    }

    setSaving(false)
  }

  const assignSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedClass || !selectedSubject) {
      setErrorMessage('Please select both a class and a subject.')
      return
    }

    setSaving(true)
    setMessage('')
    setErrorMessage('')

    const { error } = await supabase
      .from('class_subjects')
      .insert({
        school_id: schoolId,
        class_id: selectedClass,
        subject_id: selectedSubject,
      })

    if (error) {
      setErrorMessage(
        error.code === '23505'
          ? 'This subject is already assigned to that class.'
          : error.message
      )
    } else {
      setMessage('Subject assigned to class successfully.')
      setSelectedClass('')
      setSelectedSubject('')
      await loadData()
    }

    setSaving(false)
  }

  const removeAssignment = async (assignmentId: string) => {
    const confirmed = window.confirm(
      'Remove this subject from the selected class?'
    )

    if (!confirmed) return

    setMessage('')
    setErrorMessage('')

    const { error } = await supabase
      .from('class_subjects')
      .delete()
      .eq('id', assignmentId)
      .eq('school_id', schoolId)

    if (error) {
      setErrorMessage(error.message)
    } else {
      setMessage('Class subject assignment removed.')
      await loadData()
    }
  }

  const getSubjectName = (subjectId: string) =>
    subjects.find((subject) => subject.id === subjectId)?.subject_name
    ?? 'Unknown subject'

  const getClassName = (classId: string) =>
    classes.find((schoolClass) => schoolClass.id === classId)?.class_name
    ?? 'Unknown class'

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Subject Management
        </h1>
        <p className="text-slate-500 mt-1">
          Create school subjects and assign them to classes.
        </p>
      </div>

      {message && (
        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-lg">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Add New Subject
          </h2>

          <form onSubmit={addSubject} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Subject Code
              </label>
              <input
                required
                value={subjectCode}
                onChange={(event) => setSubjectCode(event.target.value)}
                placeholder="e.g. MAT"
                className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Subject Name
              </label>
              <input
                required
                value={subjectName}
                onChange={(event) => setSubjectName(event.target.value)}
                placeholder="e.g. Mathematics"
                className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg p-3 font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Subject'}
            </button>
          </form>
        </section>

        <section className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Assign Subject to Class
          </h2>

          <form onSubmit={assignSubject} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Class
              </label>
              <select
                required
                value={selectedClass}
                onChange={(event) => setSelectedClass(event.target.value)}
                className="w-full border rounded-lg p-3 bg-white"
              >
                <option value="">Choose a class</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.class_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Select Subject
              </label>
              <select
                required
                value={selectedSubject}
                onChange={(event) => setSelectedSubject(event.target.value)}
                className="w-full border rounded-lg p-3 bg-white"
              >
                <option value="">Choose a subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.subject_name} ({subject.subject_code})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={saving || classes.length === 0 || subjects.length === 0}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg p-3 font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Assign Subject'}
            </button>
          </form>
        </section>
      </div>

      <section className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            School Subjects
          </h2>
          <span className="text-sm text-slate-500">
            {subjects.length} subjects
          </span>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading subjects...</p>
        ) : subjects.length === 0 ? (
          <p className="text-slate-500">
            No subjects added yet. Use the form above to add your first subject.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Subject Name</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => (
                  <tr key={subject.id} className="border-t">
                    <td className="p-3 font-medium">{subject.subject_code}</td>
                    <td className="p-3">{subject.subject_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Class Subject Assignments
        </h2>

        {loading ? (
          <p className="text-slate-500">Loading assignments...</p>
        ) : assignments.length === 0 ? (
          <p className="text-slate-500">
            No subjects have been assigned to classes yet.
          </p>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex flex-wrap items-center justify-between gap-3 border rounded-lg p-4"
              >
                <div>
                  <p className="font-semibold text-slate-800">
                    {getSubjectName(assignment.subject_id)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {getClassName(assignment.class_id)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void removeAssignment(assignment.id)}
                  className="text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
