
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import {
  Users,
  Search,
  RefreshCw,
  Mail,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Clock,
  Pencil,
  X,
  Save,
} from 'lucide-react'

import { supabase } from '../lib/supabase'

type Props = {
  schoolId: string
}

type Teacher = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  staff_number: string | null
  auth_user_id: string | null
  status: 'active' | 'inactive'
  created_at: string
}

type TeacherForm = {
  full_name: string
  email: string
  phone: string
  staff_number: string
  status: 'active' | 'inactive'
}

const emptyForm: TeacherForm = {
  full_name: '',
  email: '',
  phone: '',
  staff_number: '',
  status: 'active',
}

export default function TeacherDirectory({ schoolId }: Props) {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const [loading, setLoading] = useState(true)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [form, setForm] = useState<TeacherForm>(emptyForm)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // --------------------------------------------------
  // 1. LOAD TEACHERS
  // --------------------------------------------------

  const loadTeachers = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const { data, error: queryError } = await supabase
        .from('teachers')
        .select(
          'id, full_name, email, phone, staff_number, auth_user_id, status, created_at'
        )
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })

      if (queryError) throw queryError

      setTeachers((data ?? []) as Teacher[])
    } catch (err) {
      console.error('Error loading teacher directory:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load the teacher directory.'
      )
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    void loadTeachers()
  }, [loadTeachers])

  // --------------------------------------------------
  // 2. SEARCH AND FILTER
  // --------------------------------------------------

  const filteredTeachers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    if (!term) return teachers

    return teachers.filter(teacher =>
      [
        teacher.full_name,
        teacher.email ?? '',
        teacher.phone ?? '',
        teacher.staff_number ?? '',
      ].some(value => value.toLowerCase().includes(term))
    )
  }, [teachers, searchTerm])

  // --------------------------------------------------
  // 3. EDIT TEACHER
  // --------------------------------------------------

  const openEditForm = (teacher: Teacher) => {
    setError('')
    setSuccess('')
    setEditingTeacher(teacher)

    setForm({
      full_name: teacher.full_name,
      email: teacher.email ?? '',
      phone: teacher.phone ?? '',
      staff_number: teacher.staff_number ?? '',
      status: teacher.status,
    })
  }

  const closeEditForm = () => {
    if (saving) return

    setEditingTeacher(null)
    setForm(emptyForm)
  }

  const updateForm = (
    field: keyof TeacherForm,
    value: string
  ) => {
    setForm(previous => ({
      ...previous,
      [field]: value,
    }))
  }

  // --------------------------------------------------
  // 4. SAVE TEACHER CHANGES
  // --------------------------------------------------

  const saveTeacher = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!editingTeacher) return

    const fullName = form.full_name.trim()
    const email = form.email.trim().toLowerCase()
    const phone = form.phone.trim()
    const staffNumber = form.staff_number.trim()

    if (fullName.length < 2 || fullName.length > 100) {
      setError('Teacher name must be between 2 and 100 characters.')
      return
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setError('Please enter a valid email address.')
      return
    }

    if (phone.length > 30) {
      setError('Phone number cannot exceed 30 characters.')
      return
    }

    if (staffNumber.length > 50) {
      setError('Staff number cannot exceed 50 characters.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { error: updateError } = await supabase
        .from('teachers')
        .update({
          full_name: fullName,
          email: email || null,
          phone: phone || null,
          staff_number: staffNumber || null,
          status: form.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingTeacher.id)
        .eq('school_id', schoolId)

      if (updateError) {
        if (updateError.code === '23505') {
          throw new Error(
            'This email address or staff number is already registered in this school.'
          )
        }

        throw updateError
      }

      setSuccess(`${fullName}'s details have been updated.`)

      setEditingTeacher(null)
      setForm(emptyForm)

      await loadTeachers()
    } catch (err) {
      console.error('Error updating teacher:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update teacher details.'
      )
    } finally {
      setSaving(false)
    }
  }

  // --------------------------------------------------
  // 5. ENABLE TEACHER LOGIN
  // --------------------------------------------------

  const enableLogin = async (teacher: Teacher) => {
    if (!teacher.email) {
      setError(
        `Add an email address for ${teacher.full_name} before enabling login.`
      )
      return
    }

    if (teacher.auth_user_id) {
      setError('This teacher already has a linked login account.')
      return
    }

    if (teacher.status !== 'active') {
      setError('Activate this teacher before enabling login.')
      return
    }

    const confirmed = window.confirm(
      `Send a login invitation to ${teacher.full_name} at ${teacher.email}?`
    )

    if (!confirmed) return

    setError('')
    setSuccess('')
    setInvitingId(teacher.id)

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke('enable-teacher-login', {
          body: {
            teacherId: teacher.id,
            schoolId,
          },
        })

      // Read the detailed Edge Function response.
      if (functionError) {
        console.error('Edge Function error:', functionError)

        let details = functionError.message

        try {
          const response = functionError.context

          if (response instanceof Response) {
            const responseBody = await response.clone().json()

            console.error(
              'Edge Function response body:',
              responseBody
            )

            details =
              responseBody.error ||
              responseBody.message ||
              details

            if (responseBody.invitationSent === true) {
              details +=
                ' An invitation may already have been sent. Do not retry until the teacher account status has been checked.'
            }
          }
        } catch (parseError) {
          console.error(
            'Could not read Edge Function response:',
            parseError
          )
        }

        throw new Error(details)
      }

      console.log('Enable teacher login response:', data)

      if (!data?.success) {
        throw new Error(
          data?.error ||
          'The teacher invitation could not be sent.'
        )
      }

      setSuccess(
        `Login invitation sent to ${teacher.full_name} (${teacher.email}).`
      )

      await loadTeachers()
    } catch (err) {
      console.error('Enable teacher login error:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to enable teacher login.'
      )
    } finally {
      setInvitingId(null)
    }
  }

  // --------------------------------------------------
  // 6. DIRECTORY STATISTICS
  // --------------------------------------------------

  const activeCount = teachers.filter(
    teacher => teacher.status === 'active'
  ).length

  const linkedCount = teachers.filter(
    teacher => Boolean(teacher.auth_user_id)
  ).length

  // --------------------------------------------------
  // 7. INITIAL LOADING
  // --------------------------------------------------

  if (loading && teachers.length === 0) {
    return (
      <div className="flex min-h-[250px] items-center justify-center">
        <RefreshCw className="h-7 w-7 animate-spin text-emerald-600" />

        <span className="ml-3 text-sm text-slate-500">
          Loading teacher directory...
        </span>
      </div>
    )
  }

  // --------------------------------------------------
  // 8. MAIN DIRECTORY
  // --------------------------------------------------

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Teacher Directory
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            View staff records and manage teacher login access.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadTeachers()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />

          <span>{error}</span>
        </div>
      )}

      {/* SUCCESS MESSAGE */}

      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />

          <span>{success}</span>
        </div>
      )}

      {/* STATISTICS */}

      <div className="grid gap-4 sm:grid-cols-3">

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <Users className="mb-3 h-6 w-6 text-emerald-600" />

          <p className="text-2xl font-bold text-slate-900">
            {teachers.length}
          </p>

          <p className="text-sm text-slate-500">
            Total Teachers
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <CheckCircle2 className="mb-3 h-6 w-6 text-blue-600" />

          <p className="text-2xl font-bold text-slate-900">
            {activeCount}
          </p>

          <p className="text-sm text-slate-500">
            Active Teachers
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <ShieldCheck className="mb-3 h-6 w-6 text-purple-600" />

          <p className="text-2xl font-bold text-slate-900">
            {linkedCount}
          </p>

          <p className="text-sm text-slate-500">
            Accounts Linked
          </p>
        </div>

      </div>

      {/* EDIT TEACHER FORM */}

      {editingTeacher && (
        <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">

          <div className="mb-5 flex items-center justify-between">

            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Edit Teacher
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Update staff information for {editingTeacher.full_name}.
              </p>
            </div>

            <button
              type="button"
              onClick={closeEditForm}
              disabled={saving}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close edit form"
            >
              <X size={20} />
            </button>

          </div>

          <form onSubmit={saveTeacher} className="space-y-4">

            <div className="grid gap-4 sm:grid-cols-2">

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Full Name *
                </label>

                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.full_name}
                  onChange={event =>
                    updateForm('full_name', event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Email Address
                </label>

                <input
                  type="email"
                  maxLength={254}
                  value={form.email}
                  onChange={event =>
                    updateForm('email', event.target.value)
                  }
                  placeholder="teacher@example.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Phone Number
                </label>

                <input
                  type="tel"
                  maxLength={30}
                  value={form.phone}
                  onChange={event =>
                    updateForm('phone', event.target.value)
                  }
                  placeholder="e.g. 07..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Staff Number
                </label>

                <input
                  type="text"
                  maxLength={50}
                  value={form.staff_number}
                  onChange={event =>
                    updateForm('staff_number', event.target.value)
                  }
                  placeholder="e.g. TCH001"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Employment Status
                </label>

                <select
                  value={form.status}
                  onChange={event =>
                    updateForm(
                      'status',
                      event.target.value as 'active' | 'inactive'
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

            </div>

            {editingTeacher.auth_user_id && (
              <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                This teacher already has a linked login account.
                Editing staff details will not change or unlink that account.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">

              <button
                type="button"
                onClick={closeEditForm}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Changes
                  </>
                )}
              </button>

            </div>

          </form>
        </div>
      )}

      {/* TEACHER TABLE */}

      <div className="rounded-xl border border-slate-200 bg-white">

        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h3 className="font-semibold text-slate-900">
              All Registered Teachers
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {filteredTeachers.length} teacher(s) displayed
            </p>
          </div>

          <div className="relative w-full sm:max-w-sm">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search name, email or staff number..."
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

        </div>

        {filteredTeachers.length === 0 ? (
          <div className="p-10 text-center">

            <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />

            <p className="font-medium text-slate-700">
              No teachers found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Register a teacher or try a different search.
            </p>

          </div>
        ) : (

          <div className="overflow-x-auto">

            <table className="w-full min-w-[950px] text-left text-sm">

              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-4">Teacher</th>
                  <th className="px-5 py-4">Contact</th>
                  <th className="px-5 py-4">Staff Number</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Login Access</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {filteredTeachers.map(teacher => {
                  const linked = Boolean(teacher.auth_user_id)
                  const inviting = invitingId === teacher.id

                  return (
                    <tr
                      key={teacher.id}
                      className="hover:bg-slate-50"
                    >

                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {teacher.full_name}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        <p>
                          {teacher.email || 'No email added'}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {teacher.phone || 'No phone added'}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {teacher.staff_number || '—'}
                      </td>

                      <td className="px-5 py-4">

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            teacher.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {teacher.status}
                        </span>

                      </td>

                      <td className="px-5 py-4">

                        {linked ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                            <ShieldCheck size={14} />
                            Account linked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                            <Clock size={14} />
                            Not enabled
                          </span>
                        )}

                      </td>

                      <td className="px-5 py-4">

                        <div className="flex items-center justify-end gap-2">

                          <button
                            type="button"
                            onClick={() => openEditForm(teacher)}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>

                          {!linked && (
                            <button
                              type="button"
                              onClick={() => void enableLogin(teacher)}
                              disabled={
                                inviting ||
                                teacher.status !== 'active' ||
                                !teacher.email
                              }
                              title={
                                !teacher.email
                                  ? 'Add an email address first'
                                  : teacher.status !== 'active'
                                    ? 'Activate this teacher first'
                                    : 'Send login invitation'
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {inviting ? (
                                <>
                                  <RefreshCw
                                    size={14}
                                    className="animate-spin"
                                  />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Mail size={14} />
                                  Enable Login
                                </>
                              )}
                            </button>
                          )}

                        </div>

                      </td>

                    </tr>
                  )
                })}

              </tbody>

            </table>

          </div>
        )}

      </div>

      <p className="text-xs text-slate-500">
        Enabling login sends an email invitation. A linked account does
        not necessarily mean the teacher has accepted the invitation
        or signed in.
      </p>

    </div>
  )
}
