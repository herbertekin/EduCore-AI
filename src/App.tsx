import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type FormEvent,
} from 'react'

import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import LandingPage from './LandingPage'
import AddSchool from './AddSchool'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const ParentFees = lazy(() => import('./pages/ParentFees'))
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'))

const AttendanceManagement = lazy(
  () => import('./pages/AttendanceManagement')
)

const AttendanceReports = lazy(
  () => import('./pages/AttendanceReports')
)

const TimetableManagement = lazy(
  () => import('./pages/TimetableManagement')
)

const AssessmentManagement = lazy(
  () => import('./pages/AssessmentManagement')
)

const ExaminationManagement = lazy(
  () => import('./pages/ExaminationManagement')
)

const ExaminationResultsManagement = lazy(
  () => import('./pages/ExaminationResultsManagement')
)

const CBEManagement = lazy(
  () => import('./pages/CBEManagement')
)

// GradingSettings.tsx is currently located directly inside src/.
const GradingSettings = lazy(
  () => import('./GradingSettings')
)

type School = {
  id: string
  name: string
  school_code: string
  county: string | null
}

type Membership = {
  school_id: string
  role: string
}

type Student = {
  id: string
  admission_number: string
  first_name: string
  last_name: string
  status: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  teacher: 'Teacher',
  bursar: 'Bursar',
  parent: 'Parent',
  student: 'Student',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Manage your school, students, staff and operations.',
  teacher: 'Manage classes, attendance and academic performance.',
  bursar: 'Manage school fees, invoices and payments.',
  parent: 'View your children and their school information.',
  student: 'Access your academic information and school updates.',
}

const ROLE_ICONS: Record<string, string> = {
  admin: '🛡️',
  teacher: '👩‍🏫',
  bursar: '💰',
  parent: '👨‍👩‍👧',
  student: '🎓',
}

// This email is only used to control the frontend navigation.
// The database RPC remains the authoritative security check.
const PLATFORM_OWNER_EMAIL = 'tekinbutaki@gmail.com'

function PageLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />

        <p className="text-slate-600 font-medium">
          Loading EduCore AI...
        </p>
      </div>
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)

  const [authLoading, setAuthLoading] = useState(true)
  const [loading, setLoading] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showLogin, setShowLogin] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false)

  const [schools, setSchools] = useState<School[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])

  const [selectedMembership, setSelectedMembership] =
    useState<Membership | null>(null)

  const [showAddSchool, setShowAddSchool] = useState(false)

  const [students, setStudents] = useState<Student[]>([])
  const [selectedFeeStudent, setSelectedFeeStudent] =
    useState<Student | null>(null)

  const [adminPage, setAdminPage] = useState<
    | 'dashboard'
    | 'reports'
    | 'timetable'
    | 'assessments'
    | 'examinations'
    | 'examinationResults'
    | 'cbe'
    | 'gradingSettings'
  >('dashboard')

  const [teacherPage, setTeacherPage] = useState<
    'dashboard' | 'attendance' | 'reports' | 'examinationResults'
  >('dashboard')

  const [message, setMessage] = useState('')

  const isPlatformOwner =
    session?.user.email?.toLowerCase() === PLATFORM_OWNER_EMAIL

  // Detect invitation or recovery links in the URL.
  const hashParams = new URLSearchParams(
    window.location.hash.substring(1)
  )

  const invitationFlow =
    hashParams.get('type') === 'invite' ||
    hashParams.get('type') === 'recovery'

  // --------------------------------------------------
  // 1. AUTHENTICATION AND SESSION RESTORATION
  // --------------------------------------------------

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) {
        setMessage(error.message)
      }

      setSession(data.session)

      if (data.session && invitationFlow) {
        setNeedsPasswordSetup(true)
      }

      setAuthLoading(false)
    }

    void initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)

      if (
        event === 'PASSWORD_RECOVERY' ||
        (event === 'SIGNED_IN' && invitationFlow)
      ) {
        setNeedsPasswordSetup(true)
      }

      if (event === 'SIGNED_OUT') {
        setNeedsPasswordSetup(false)
        setNewPassword('')
        setConfirmPassword('')
        setTeacherPage('dashboard')
        setAdminPage('dashboard')
      }

      setSelectedMembership(null)
      setSelectedFeeStudent(null)

      setSchools([])
      setMemberships([])
      setStudents([])

      setMessage('')
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // --------------------------------------------------
  // 2. LOAD USER SCHOOL MEMBERSHIPS AND SCHOOLS
  // --------------------------------------------------

  useEffect(() => {
    if (!session || needsPasswordSetup) {
      setMemberships([])
      setSchools([])
      setStudents([])
      setLoading(false)
      return
    }

    let cancelled = false

    const loadMemberships = async () => {
      setLoading(true)
      setMessage('')

      const { data, error } = await supabase
        .from('school_memberships')
        .select('school_id, role')
        .eq('user_id', session.user.id)

      if (cancelled) return

      if (error) {
        setMessage(`Could not load your school roles: ${error.message}`)
        setMemberships([])
        setSchools([])
        setLoading(false)
        return
      }

      const userMemberships = (data ?? []) as Membership[]

      setMemberships(userMemberships)

      if (userMemberships.length === 0) {
        setMessage('This account has no school membership.')
        setSchools([])
        setLoading(false)
        return
      }

      const schoolIds = [
        ...new Set(
          userMemberships.map((membership) => membership.school_id)
        ),
      ]

      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('id, name, school_code, county')
        .in('id', schoolIds)
        .order('name')

      if (cancelled) return

      if (schoolError) {
        setMessage(`Could not load schools: ${schoolError.message}`)
        setSchools([])
      } else {
        setSchools((schoolData ?? []) as School[])
      }

      setLoading(false)
    }

    void loadMemberships()

    return () => {
      cancelled = true
    }
  }, [session, needsPasswordSetup])

  // --------------------------------------------------
  // 3. LOAD CHILDREN FOR THE SELECTED PARENT SCHOOL
  // --------------------------------------------------

  useEffect(() => {
    if (
      !session ||
      !selectedMembership ||
      selectedMembership.role !== 'parent'
    ) {
      setStudents([])
      return
    }

    let cancelled = false

    const loadChildren = async () => {
      setLoading(true)
      setMessage('')

      const { data, error } = await supabase
        .from('guardians')
        .select(`
          id,
          student_guardians (
            relationship,
            students (
              id,
              admission_number,
              first_name,
              last_name,
              status
            )
          )
        `)
        .eq('user_id', session.user.id)
        .eq('school_id', selectedMembership.school_id)

      if (cancelled) return

      if (error) {
        setMessage(`Could not load linked students: ${error.message}`)
        setStudents([])
        setLoading(false)
        return
      }

      const linked: Student[] = []

      for (const guardian of (data ?? []) as any[]) {
        for (const link of guardian.student_guardians ?? []) {
          if (link.students) {
            linked.push(link.students as Student)
          }
        }
      }

      const uniqueStudents = Array.from(
        new Map(
          linked.map((student) => [student.id, student])
        ).values()
      )

      setStudents(uniqueStudents)
      setLoading(false)
    }

    void loadChildren()

    return () => {
      cancelled = true
    }
  }, [session, selectedMembership])

  // --------------------------------------------------
  // 4. LOGIN
  // --------------------------------------------------

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setMessage(error.message)
    }

    setLoading(false)
  }

  // --------------------------------------------------
  // 5. SET PASSWORD FOR INVITED USERS
  // --------------------------------------------------

  const handleSetPassword = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    setMessage('')

    if (newPassword.length < 8) {
      setMessage('Your password must contain at least 8 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage('The passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      setNewPassword('')
      setConfirmPassword('')
      setNeedsPasswordSetup(false)

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      )

      setMessage('Your password has been created successfully.')
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : 'Unable to create your password.'
      )
    } finally {
      setLoading(false)
    }
  }

  // --------------------------------------------------
  // 6. LOGOUT
  // --------------------------------------------------

  const handleLogout = async () => {
    setLoading(true)

    const { error } = await supabase.auth.signOut()

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setSession(null)
    setShowLogin(false)
    setShowAddSchool(false)
    setSelectedMembership(null)
    setSelectedFeeStudent(null)
    setNeedsPasswordSetup(false)

    setTeacherPage('dashboard')
    setAdminPage('dashboard')

    setSchools([])
    setMemberships([])
    setStudents([])

    setMessage('')
    setLoading(false)
  }

  // --------------------------------------------------
  // 7. RETURN TO ROLE SELECTION
  // --------------------------------------------------

  const handleBackToRoles = () => {
    setSelectedMembership(null)
    setSelectedFeeStudent(null)

    setTeacherPage('dashboard')
    setAdminPage('dashboard')

    setStudents([])
    setMessage('')
  }

  // --------------------------------------------------
  // 8. AUTHENTICATION LOADING SCREEN
  // --------------------------------------------------

  if (authLoading) {
    return <PageLoading />
  }

  // --------------------------------------------------
  // 9. INVITATION PASSWORD SETUP SCREEN
  // --------------------------------------------------

  if (session && needsPasswordSetup) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">

          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🔐</div>

            <h1 className="text-3xl font-bold text-slate-900">
              EduCore AI
            </h1>

            <p className="text-slate-500 mt-2">
              Complete your teacher account setup.
            </p>
          </div>

          <h2 className="text-xl font-semibold mb-2">
            Create Your Password
          </h2>

          <p className="text-sm text-slate-500 mb-6">
            Choose a secure password to access your school portal.
          </p>

          <form onSubmit={handleSetPassword} className="space-y-4">

            <div>
              <label className="block text-sm font-medium mb-2">
                New Password
              </label>

              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
                className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Confirm Password
              </label>

              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Enter your password again"
                className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            {message && (
              <p className="text-sm text-red-600">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg p-3 disabled:opacity-50"
            >
              {loading ? 'Saving Password...' : 'Create Password'}
            </button>

          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            Keep your password private and secure.
          </p>

        </div>
      </main>
    )
  }

  // --------------------------------------------------
  // 10. LOGIN SCREEN
  // --------------------------------------------------

  if (!session && !showLogin) {
    return (
      <LandingPage onSignIn={() => setShowLogin(true)} />
    )
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">

          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🎓</div>

            <h1 className="text-3xl font-bold text-slate-900">
              EduCore AI
            </h1>

            <p className="text-slate-500 mt-2">
              Smart Schools. Brighter Futures.
            </p>
          </div>

          <h2 className="text-xl font-semibold mb-5">
            Sign in to EduCore AI
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">

            <div>
              <label className="block text-sm font-medium mb-2">
                Email Address
              </label>

              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Password
              </label>

              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            {message && (
              <p className="text-sm text-red-600">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg p-3 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

          </form>

          <button
            type="button"
            onClick={() => setShowLogin(false)}
            className="mt-4 w-full rounded-lg border border-slate-200 p-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Back to home
          </button>

          <p className="text-center text-xs text-slate-400 mt-6">
            EduCore AI School Management System
          </p>

        </div>
      </main>
    )
  }

  // --------------------------------------------------
  // 11. LOAD USER PERMISSIONS
  // --------------------------------------------------

  if (loading && memberships.length === 0) {
    return <PageLoading />
  }

  // --------------------------------------------------
  // 12. NO SCHOOL MEMBERSHIP
  // --------------------------------------------------

  if (memberships.length === 0) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">

          <div className="text-4xl mb-4">🔒</div>

          <h2 className="text-xl font-bold text-slate-900">
            No school access
          </h2>

          <p className="text-slate-600 mt-3">
            This account does not currently have a school membership.
            Please contact your school administrator.
          </p>

          {message && (
            <p className="text-red-600 text-sm mt-4">
              {message}
            </p>
          )}

          <button
            onClick={handleLogout}
            className="mt-6 w-full bg-red-500 hover:bg-red-600 text-white rounded-lg p-3"
          >
            Logout
          </button>

        </div>
      </main>
    )
  }

  // --------------------------------------------------
  // 13. SCHOOL LOOKUP
  // --------------------------------------------------

  const getSchool = (schoolId: string) =>
    schools.find((school) => school.id === schoolId)

  // --------------------------------------------------
  // ADD ANOTHER SCHOOL TO THE CURRENT ADMIN ACCOUNT
  // --------------------------------------------------

  const handleSchoolAdded = (school: School) => {
    setSchools((current) =>
      current.some((item) => item.id === school.id) ? current : [...current, school]
    )
    setMemberships((current) =>
      current.some((item) => item.school_id === school.id && item.role === 'admin')
        ? current
        : [...current, { school_id: school.id, role: 'admin' }]
    )
    setShowAddSchool(false)
    setMessage('')
  }

  if (showAddSchool && isPlatformOwner) {
    return (
      <AddSchool
        onBack={() => setShowAddSchool(false)}
        onSchoolAdded={handleSchoolAdded}
      />
    )
  }

  // --------------------------------------------------
  // 14. SELECTED ROLE AND SCHOOL
  // --------------------------------------------------

  if (!selectedMembership) {
    return (
      <main className="min-h-screen bg-slate-100">

        <header className="bg-slate-900 text-white px-4 py-4 sm:px-6 sm:py-5 flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              🎓 EduCore AI
            </h1>

            <p className="text-slate-300 text-sm">
              Select your portal
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm"
          >
            Logout
          </button>
        </header>

        <section className="max-w-5xl mx-auto p-4 sm:p-6">

          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <p className="text-slate-500 text-sm">
              Welcome back
            </p>

            <h2 className="text-xl font-bold text-slate-900 mt-1">
              {session.user.email}
            </h2>

            <p className="text-slate-500 text-sm mt-2">
              Choose the school and portal you want to access.
            </p>
          </div>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              Your available portals
            </h2>
            {isPlatformOwner &&
              memberships.some((membership) => membership.role === 'admin') && (
              <button
                type="button"
                onClick={() => setShowAddSchool(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                + Add another school
              </button>
            )}
          </div>

          {loading && (
            <p className="text-slate-500 mb-4">
              Loading your school information...
            </p>
          )}

          {message && (
            <p className="text-red-600 bg-red-50 p-4 rounded-lg mb-4">
              {message}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">

            {memberships.map((membership, index) => {
              const school = getSchool(membership.school_id)

              if (!school) return null

              const role = membership.role

              return (
                <button
                  key={`${membership.school_id}-${role}-${index}`}
                  onClick={() => {
                    setSelectedMembership(membership)
                    setSelectedFeeStudent(null)
                    setTeacherPage('dashboard')
                    setAdminPage('dashboard')
                    setMessage('')
                  }}
                  className="text-left bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:border-emerald-500 hover:shadow-md transition"
                >

                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">
                      {ROLE_ICONS[role] ?? '🏫'}
                    </span>

                    <div>
                      <h3 className="font-bold text-lg text-slate-900">
                        {ROLE_LABELS[role] ?? role}
                      </h3>

                      <p className="text-xs text-emerald-600">
                        {school.name}
                      </p>
                    </div>
                  </div>

                  <p className="text-slate-600 text-sm">
                    {ROLE_DESCRIPTIONS[role] ??
                      'Access your assigned school portal.'}
                  </p>

                  <p className="text-slate-400 text-xs mt-4">
                    School Code: {school.school_code}
                  </p>

                  <div className="mt-5 text-emerald-700 font-semibold text-sm">
                    Enter Portal →
                  </div>

                </button>
              )
            })}

          </div>

        </section>
      </main>
    )
  }

  // --------------------------------------------------
  // 15. SELECTED SCHOOL INFORMATION
  // --------------------------------------------------

  const selectedSchool = getSchool(selectedMembership.school_id)

  if (!selectedSchool) {
    return <PageLoading />
  }

  // --------------------------------------------------
  // 16. ADMINISTRATOR PORTAL
  // --------------------------------------------------

  if (selectedMembership.role === 'admin') {
    return (
      <Suspense fallback={<PageLoading />}>
        <div className="min-h-screen bg-slate-100">

          <header className="bg-slate-900 px-3 py-4 sm:px-6">
            <div className="max-w-7xl mx-auto flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <h2 className="text-white font-bold text-lg">
                  Administrator Portal
                </h2>

                <p className="text-slate-300 text-sm">
                  {selectedSchool.name}
                </p>
              </div>

              <nav
                aria-label="Administrator navigation"
                className="-mx-1 flex w-full gap-2 overflow-x-auto px-1 pb-2 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0"
              >

                <button
                  onClick={() => setAdminPage('dashboard')}
                  className={`min-h-10 shrink-0 px-4 py-2 rounded-lg text-sm font-medium ${
                    adminPage === 'dashboard'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Dashboard
                </button>

                <button
                  onClick={() => setAdminPage('reports')}
                  className={`min-h-10 shrink-0 px-4 py-2 rounded-lg text-sm font-medium ${
                    adminPage === 'reports'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  📊 Attendance Reports
                </button>

                <button
                  onClick={() => setAdminPage('timetable')}
                  className={`min-h-10 shrink-0 px-4 py-2 rounded-lg text-sm font-medium ${
                    adminPage === 'timetable'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  🗓️ Timetable
                </button>

                <button
                  onClick={() => setAdminPage('assessments')}
                  className={`min-h-10 shrink-0 px-4 py-2 rounded-lg text-sm font-medium ${
                    adminPage === 'assessments'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  📝 Assessments
                </button>

                <button
                  onClick={() => setAdminPage('examinations')}
                  className={`min-h-10 shrink-0 px-4 py-2 rounded-lg text-sm font-medium ${
                    adminPage === 'examinations'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  📋 Examinations
                </button>

                <button
                  onClick={() => setAdminPage('examinationResults')}
                  className={`min-h-10 shrink-0 px-4 py-2 rounded-lg text-sm font-medium ${
                    adminPage === 'examinationResults'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  📊 Results & Marks
                </button>

                <button
                  onClick={() => setAdminPage('cbe')}
                  className={`min-h-10 shrink-0 px-4 py-2 rounded-lg text-sm font-medium ${
                    adminPage === 'cbe'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  🎯 CBE Management
                </button>

                <button
                  onClick={() => setAdminPage('gradingSettings')}
                  className={`min-h-10 shrink-0 px-4 py-2 rounded-lg text-sm font-medium ${
                    adminPage === 'gradingSettings'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  🎓 Grading Settings
                </button>

                <button
                  onClick={handleBackToRoles}
                  className="min-h-10 shrink-0 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Change Portal
                </button>

                <button
                  onClick={handleLogout}
                  className="min-h-10 shrink-0 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Logout
                </button>

              </nav>
            </div>
          </header>

          {adminPage === 'gradingSettings' ? (
            <GradingSettings
              schoolId={selectedSchool.id}
              schoolName={selectedSchool.name}
              onBack={() => setAdminPage('dashboard')}
            />
          ) : adminPage === 'examinations' ? (
            <ExaminationManagement
              schoolId={selectedSchool.id}
              schoolName={selectedSchool.name}
              onBack={() => setAdminPage('dashboard')}
            />
          ) : adminPage === 'examinationResults' ? (
            <ExaminationResultsManagement
              schoolId={selectedSchool.id}
              schoolName={selectedSchool.name}
              role="admin"
              onBack={() => setAdminPage('dashboard')}
            />
          ) : adminPage === 'cbe' ? (
            <CBEManagement
              schoolId={selectedSchool.id}
              schoolName={selectedSchool.name}
              onBack={() => setAdminPage('dashboard')}
            />
          ) : adminPage === 'assessments' ? (
            <AssessmentManagement
              schoolId={selectedSchool.id}
              schoolName={selectedSchool.name}
              onBack={() => setAdminPage('dashboard')}
            />
          ) : adminPage === 'reports' ? (
            <AttendanceReports
              schoolId={selectedSchool.id}
              schoolName={selectedSchool.name}
              onBack={() => setAdminPage('dashboard')}
            />
          ) : adminPage === 'timetable' ? (
            <TimetableManagement
              schoolId={selectedSchool.id}
              schoolName={selectedSchool.name}
              onBack={() => setAdminPage('dashboard')}
            />
          ) : (
            <Dashboard
              schoolId={selectedSchool.id}
              schoolName={selectedSchool.name}
              onLogout={handleLogout}
            />
          )}

        </div>
      </Suspense>
    )
  }

  // --------------------------------------------------
  // 17. PARENT PORTAL
  // --------------------------------------------------

  if (selectedMembership.role === 'parent') {

    if (selectedFeeStudent) {
      return (
        <Suspense fallback={<PageLoading />}>
          <ParentFees
            studentId={selectedFeeStudent.id}
            studentName={`${selectedFeeStudent.first_name} ${selectedFeeStudent.last_name}`}
            onBack={() => setSelectedFeeStudent(null)}
          />
        </Suspense>
      )
    }

    return (
      <main className="min-h-screen bg-slate-100">

        <header className="bg-slate-900 text-white px-4 py-4 sm:px-6 sm:py-5 flex flex-wrap justify-between items-center gap-3">

          <div>
            <h1 className="text-2xl font-bold">
              🎓 EduCore AI
            </h1>

            <p className="text-slate-300 text-sm">
              Parent Portal · {selectedSchool.name}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm"
          >
            Logout
          </button>

        </header>

        <section className="max-w-5xl mx-auto p-4 sm:p-6">

          <button
            onClick={handleBackToRoles}
            className="text-emerald-700 font-medium text-sm mb-5"
          >
            ← Change Portal
          </button>

          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">

            <p className="text-slate-500 text-sm">
              Welcome
            </p>

            <h2 className="text-xl font-bold text-slate-900">
              {session.user.email}
            </h2>

            <p className="text-emerald-600 text-sm mt-2">
              Signed in with Parent access
            </p>

          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-4">
            My Children
          </h2>

          {loading && (
            <p className="text-slate-500">
              Loading linked students...
            </p>
          )}

          {message && (
            <p className="text-red-600 bg-red-50 p-4 rounded-lg mb-4">
              {message}
            </p>
          )}

          {!loading && !message && students.length === 0 && (
            <div className="bg-white rounded-xl p-6">
              No linked students were found for this parent account.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">

            {students.map((student) => (
              <div
                key={student.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
              >

                <h3 className="text-lg font-bold text-slate-900">
                  {student.first_name} {student.last_name}
                </h3>

                <p className="text-slate-500 text-sm mt-2">
                  Admission Number: {student.admission_number}
                </p>

                <p className="text-slate-500 text-sm mt-1">
                  Status: {student.status}
                </p>

                <button
                  onClick={() => setSelectedFeeStudent(student)}
                  className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg p-3 font-semibold"
                >
                  View School Fees →
                </button>

              </div>
            ))}

          </div>

        </section>
      </main>
    )
  }

  // --------------------------------------------------
  // 18. TEACHER PORTAL
  // --------------------------------------------------

  if (selectedMembership.role === 'teacher') {
    return (
      <Suspense fallback={<PageLoading />}>
        <div className="min-h-screen bg-slate-100">

          <header className="bg-slate-900 px-3 py-4 sm:px-6">
            <div className="max-w-7xl mx-auto flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <h2 className="text-white font-bold text-lg">
                  Teacher Portal
                </h2>

                <p className="text-slate-300 text-sm">
                  {selectedSchool.name}
                </p>
              </div>

              <nav
                aria-label="Teacher navigation"
                className="-mx-1 flex w-full gap-2 overflow-x-auto px-1 pb-2 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0"
              >

                <button
                  onClick={() => setTeacherPage('dashboard')}
                  className={`min-h-10 shrink-0 px-4 py-2 rounded-lg text-sm font-medium ${
                    teacherPage === 'dashboard'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Dashboard
                </button>

                <button
                  onClick={() => setTeacherPage('attendance')}
                  className={`min-h-10 shrink-0 px-4 py-2 rounded-lg text-sm font-medium ${
                    teacherPage === 'attendance'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  📋 Attendance
                </button>

                <button
                  onClick={() => setTeacherPage('reports')}
                  className={`min-h-10 shrink-0 px-4 py-2 rounded-lg text-sm font-medium ${
                    teacherPage === 'reports'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  📊 Attendance Reports
                </button>

                <button
                  onClick={() => setTeacherPage('examinationResults')}
                  className={`min-h-10 shrink-0 px-4 py-2 rounded-lg text-sm font-medium ${
                    teacherPage === 'examinationResults'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  📝 Examination Marks
                </button>

                <button
                  onClick={handleBackToRoles}
                  className="min-h-10 shrink-0 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Change Portal
                </button>

                <button
                  onClick={handleLogout}
                  className="min-h-10 shrink-0 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Logout
                </button>

              </nav>
            </div>
          </header>

          {teacherPage === 'examinationResults' ? (
            <ExaminationResultsManagement
              schoolId={selectedSchool.id}
              schoolName={selectedSchool.name}
              role="teacher"
              onBack={() => setTeacherPage('dashboard')}
            />
          ) : teacherPage === 'attendance' ? (
            <AttendanceManagement
              schoolId={selectedSchool.id}
              schoolName={selectedSchool.name}
              onBack={() => setTeacherPage('dashboard')}
            />
          ) : teacherPage === 'reports' ? (
            <AttendanceReports
              schoolId={selectedSchool.id}
              schoolName={selectedSchool.name}
              onBack={() => setTeacherPage('dashboard')}
            />
          ) : (
            <TeacherDashboard
              schoolId={selectedSchool.id}
              schoolName={selectedSchool.name}
              onLogout={handleLogout}
            />
          )}

        </div>
      </Suspense>
    )
  }

  // --------------------------------------------------
  // 19. FALLBACK FOR OTHER ROLES (E.G. BURSAR)
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
        <h2 className="text-xl font-bold text-slate-900">
          Portal Coming Soon
        </h2>
        <p className="text-slate-600 mt-3">
          The {selectedMembership.role} portal for {selectedSchool.name} is currently under development.
        </p>
        <button
          onClick={handleBackToRoles}
          className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg p-3"
        >
          Back to Portal Selection
        </button>
      </div>
    </main>
  )
}
