import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'

type LandingPageProps = {
  onSignIn: () => void
}

const features = [
  {
    icon: Users,
    title: 'Student & Staff Management',
    description:
      'Keep student records, teacher information and school structures organised in one place.',
  },
  {
    icon: Wallet,
    title: 'Fees & Payments',
    description:
      'Track fee balances, payment records and receipts with a clearer view of school finances.',
  },
  {
    icon: CalendarCheck,
    title: 'Attendance & Timetables',
    description:
      'Record attendance and coordinate class schedules without relying on scattered paperwork.',
  },
  {
    icon: ClipboardList,
    title: 'Examinations & Results',
    description:
      'Manage assessments, examination marks and academic progress from a central workspace.',
  },
  {
    icon: BookOpen,
    title: 'CBC Support',
    description:
      'Organise competency-based assessment information and monitor learner performance.',
  },
  {
    icon: Sparkles,
    title: 'AI-assisted Insights',
    description:
      'Make school information easier to understand and support more informed decisions.',
  },
]

export default function LandingPage({ onSignIn }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 text-left"
            aria-label="EduCore AI home"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm">
              <GraduationCap size={25} />
            </span>
            <span>
              <span className="block text-lg font-extrabold tracking-tight">
                EduCore<span className="text-emerald-700">AI</span>
              </span>
              <span className="block text-[11px] font-medium tracking-wide text-slate-500">
                SCHOOL MANAGEMENT
              </span>
            </span>
          </button>

          <nav className="hidden items-center gap-8 md:flex">
            <button onClick={() => goTo('features')} className="text-sm font-semibold text-slate-600 transition hover:text-emerald-700">
              Features
            </button>
            <button onClick={() => goTo('how-it-works')} className="text-sm font-semibold text-slate-600 transition hover:text-emerald-700">
              How it works
            </button>
            <button onClick={() => goTo('about')} className="text-sm font-semibold text-slate-600 transition hover:text-emerald-700">
              About
            </button>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <button onClick={onSignIn} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
              Sign in
            </button>
            <button onClick={onSignIn} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800">
              Access portal <ArrowRight size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 md:hidden"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              <button onClick={() => goTo('features')} className="rounded-lg px-3 py-3 text-left text-sm font-semibold hover:bg-slate-50">Features</button>
              <button onClick={() => goTo('how-it-works')} className="rounded-lg px-3 py-3 text-left text-sm font-semibold hover:bg-slate-50">How it works</button>
              <button onClick={() => goTo('about')} className="rounded-lg px-3 py-3 text-left text-sm font-semibold hover:bg-slate-50">About</button>
              <button onClick={onSignIn} className="mt-2 rounded-xl bg-emerald-700 px-4 py-3 text-center text-sm font-bold text-white">Sign in to your portal</button>
            </div>
          </div>
        )}
      </header>

      <section className="relative isolate">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-50 via-white to-amber-50" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-800 shadow-sm">
              <Sparkles size={15} /> A smarter way to manage schools
            </div>
            <h1 className="max-w-2xl text-4xl font-black leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Bring your school operations
              <span className="text-emerald-700"> into one place.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              EduCoreAI helps schools organise learners, staff, fees, attendance
              and academic records through one connected school management
              platform.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={onSignIn} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/10 transition hover:-translate-y-0.5 hover:bg-emerald-800">
                Access your school portal <ArrowRight size={18} />
              </button>
              <button onClick={() => goTo('features')} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">
                Explore features
              </button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={17} className="text-emerald-700" /> Connected school workflows</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck size={17} className="text-emerald-700" /> Role-based access</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -left-8 top-10 h-36 w-36 rounded-full bg-emerald-200/60 blur-3xl" />
            <div className="absolute -bottom-8 -right-5 h-40 w-40 rounded-full bg-amber-200/60 blur-3xl" />
            <div className="relative rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10 sm:p-5">
              <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400">SCHOOL OVERVIEW</p>
                  <p className="mt-1 text-lg font-extrabold text-slate-900">Your school at a glance</p>
                </div>
                <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Dashboard preview</span>
              </div>
              <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-2">
                {[
                  ['Learners', 'Student records', '🎓'],
                  ['Staff', 'Teacher records', '👩‍🏫'],
                  ['Attendance', 'Daily tracking', '📅'],
                  ['Academics', 'Results & progress', '📚'],
                ].map(([title, subtitle, emoji]) => (
                  <div key={title} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm">{emoji}</div>
                    <p className="font-bold text-slate-800">{title}</p>
                    <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl bg-emerald-800 p-4 text-white sm:p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold">One connected workspace</p>
                    <p className="mt-1 text-xs leading-5 text-emerald-100">Bring essential school information together.</p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <GraduationCap size={25} />
                  </div>
                </div>
              </div>
              <p className="px-2 pt-3 text-center text-[11px] text-slate-400">Illustrative interface preview — not live school data</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-700">Everything connected</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">The essential tools your school needs</h2>
            <p className="mt-4 leading-7 text-slate-600">Designed to bring everyday school administration and academic workflows into a more organised digital space.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-900/5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon size={23} /></div>
                <h3 className="mt-5 text-lg font-extrabold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 bg-slate-50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-700">Simple workflow</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A clearer way to work together</h2>
            <p className="mt-4 leading-7 text-slate-600">EduCoreAI brings the right school information to the people who need it, based on their assigned role.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              ['01', 'Your school is set up', 'School administrators organise school details, classes, staff and learner records.'],
              ['02', 'Teams manage daily work', 'Authorised staff use the relevant tools for attendance, fees, assessments and results.'],
              ['03', 'Information stays connected', 'School teams can work from more consistent records and follow learner progress.'],
            ].map(([number, title, description]) => (
              <div key={number} className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="text-sm font-black text-emerald-700">{number}</span>
                <h3 className="mt-4 text-lg font-extrabold">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-8 rounded-3xl bg-emerald-900 p-7 text-white sm:p-10 lg:grid-cols-[1.4fr_0.6fr] lg:p-14">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-200">About EduCoreAI</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Supporting more organised, connected schools.</h2>
            <p className="mt-5 max-w-2xl leading-8 text-emerald-100">EduCoreAI is being developed with the needs of schools in mind, including schools looking for practical ways to move from disconnected paperwork and records to more accessible digital workflows.</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-6">
            <GraduationCap size={34} className="text-emerald-200" />
            <p className="mt-4 text-xl font-extrabold">Smart Schools.</p>
            <p className="text-xl font-extrabold text-emerald-200">Brighter Futures.</p>
            <button onClick={onSignIn} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-emerald-900 transition hover:bg-emerald-50">
              Go to school portal <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div>
            <p className="font-extrabold">EduCore<span className="text-emerald-700">AI</span></p>
            <p className="mt-1 text-xs text-slate-500">Smart Schools. Brighter Futures.</p>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} EduCoreAI. All rights reserved.</p>
          <button onClick={onSignIn} className="text-sm font-bold text-emerald-700 hover:text-emerald-900">School portal sign in</button>
        </div>
      </footer>
    </main>
  )
}
