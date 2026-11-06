
import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Users,
  GraduationCap,
  School,
  Wallet,
  LogOut,
  LayoutDashboard,
  Settings,
  CalendarDays,
  Calculator,
  FileText,
  Menu,
  X,
  Banknote,
  Receipt,
  ChartNoAxesCombined,
  BookOpen,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import StatCard from '../components/StatCard';

// Lazy-loaded pages
const StudentManagement = lazy(() => import('./StudentManagement'));
const ClassManagement = lazy(() => import('./ClassManagement'));
const AcademicCalendar = lazy(() => import('./AcademicCalendar'));
const FeeVoteheadManagement = lazy(() => import('./FeeVoteheadManagement'));
const FeeStructureManagement = lazy(() => import('./FeeStructureManagement'));
const InvoiceManagement = lazy(() => import('./InvoiceManagement'));
const PaymentManagement = lazy(() => import('./PaymentManagement'));
const FinanceOverview = lazy(() => import('./FinanceOverview'));
const SubjectManagement = lazy(() => import('./SubjectManagement'));

// Teacher registration + assignment management
const TeacherManagement = lazy(() => import('./TeacherManagement'));

// Page types
type Page =
  | 'dashboard'
  | 'students'
  | 'teachers'
  | 'classes'
  | 'calendar'
  | 'finance'
  | 'fee-structures'
  | 'invoices'
  | 'payments'
  | 'finance-overview'
  | 'subjects'
  | 'settings';

type DashboardProps = {
  schoolId: string;
  schoolName?: string;
  onLogout: () => void;
};

type DashboardStats = {
  students: number;
  classes: number;
  staff: number;
};

type NavigationItem = {
  id: Page;
  label: string;
  icon: typeof LayoutDashboard;
};

// Loading component for lazy-loaded pages
function PageLoading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <p className="mt-3 text-sm text-slate-500">
          Loading page...
        </p>
      </div>
    </div>
  );
}

export default function Dashboard({
  schoolId,
  schoolName = 'EduCore AI',
  onLogout,
}: DashboardProps) {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<DashboardStats>({
    students: 0,
    classes: 0,
    staff: 0,
  });

  // Sidebar navigation
  const navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'students',
      label: 'Students',
      icon: GraduationCap,
    },
    {
      id: 'teachers',
      label: 'Teachers',
      icon: Users,
    },
    {
      id: 'classes',
      label: 'Classes & Streams',
      icon: School,
    },
    {
      id: 'calendar',
      label: 'Academic Calendar',
      icon: CalendarDays,
    },
    {
      id: 'subjects',
      label: 'Subject Management',
      icon: BookOpen,
    },
    {
      id: 'finance-overview',
      label: 'Finance Overview',
      icon: ChartNoAxesCombined,
    },
    {
      id: 'finance',
      label: 'Fee Voteheads',
      icon: Calculator,
    },
    {
      id: 'fee-structures',
      label: 'Fee Structures',
      icon: Wallet,
    },
    {
      id: 'invoices',
      label: 'Invoices',
      icon: FileText,
    },
    {
      id: 'payments',
      label: 'Payments',
      icon: Banknote,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  // Load dashboard statistics
  useEffect(() => {
    let cancelled = false;

    const loadDashboardStats = async () => {
      setLoading(true);

      try {
        const [
          studentResponse,
          classResponse,
          staffResponse,
        ] = await Promise.all([
          supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', schoolId),

          supabase
            .from('classes')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', schoolId),

          supabase
            .from('school_memberships')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', schoolId)
            .in('role', ['teacher', 'admin']),
        ]);

        if (studentResponse.error) throw studentResponse.error;
        if (classResponse.error) throw classResponse.error;
        if (staffResponse.error) throw staffResponse.error;

        if (!cancelled) {
          setStats({
            students: studentResponse.count ?? 0,
            classes: classResponse.count ?? 0,
            staff: staffResponse.count ?? 0,
          });
        }
      } catch (error) {
        console.error(
          'Error loading dashboard statistics:',
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDashboardStats();

    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  // Navigation handler
  const navigateTo = (page: Page) => {
    setActivePage(page);
    setSidebarOpen(false);
  };

  // Dashboard home
  const renderDashboardHome = () => (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          School Dashboard
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Welcome to {schoolName}. Here's an overview of your school.
        </p>
      </div>

      {/* Statistics */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Students"
          value={loading ? '...' : stats.students.toString()}
          description="Registered students in this school"
          icon={GraduationCap}
        />

        <StatCard
          title="Total Classes"
          value={loading ? '...' : stats.classes.toString()}
          description="Classes configured in the school"
          icon={School}
        />

        <StatCard
          title="Teachers & Admins"
          value={loading ? '...' : stats.staff.toString()}
          description="Registered school staff"
          icon={Users}
        />

        <StatCard
          title="Fee Management"
          value="Configured"
          description="Voteheads and fee structures"
          icon={Wallet}
        />
      </div>

      {/* Quick Actions */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Quick Actions
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => navigateTo('students')}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-emerald-300 hover:shadow-sm"
          >
            <div className="rounded-lg bg-emerald-50 p-3">
              <GraduationCap className="h-6 w-6 text-emerald-700" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                Add Student
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Register a new student
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('teachers')}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-emerald-300 hover:shadow-sm"
          >
            <div className="rounded-lg bg-blue-50 p-3">
              <Users className="h-6 w-6 text-blue-700" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                Manage Teachers
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Register and assign teachers
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('invoices')}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-emerald-300 hover:shadow-sm"
          >
            <div className="rounded-lg bg-amber-50 p-3">
              <Receipt className="h-6 w-6 text-amber-700" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                Generate Invoices
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Create student fee invoices
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('payments')}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-emerald-300 hover:shadow-sm"
          >
            <div className="rounded-lg bg-emerald-50 p-3">
              <Banknote className="h-6 w-6 text-emerald-700" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                Record Payment
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Record student fee payments
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Finance overview */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          EduCore AI Finance
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Manage fee voteheads, configure class fee structures,
          generate student invoices and record payments from one
          centralized school management system.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigateTo('finance-overview')}
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Open Finance Overview
          </button>

          <button
            type="button"
            onClick={() => navigateTo('fee-structures')}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Manage Fee Structures
          </button>

          <button
            type="button"
            onClick={() => navigateTo('payments')}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open Payments
          </button>
        </div>
      </section>
    </div>
  );

  // Render selected page
  const renderPage = () => {
    switch (activePage) {
      case 'students':
        return <StudentManagement schoolId={schoolId} />;

      case 'teachers':
        return <TeacherManagement schoolId={schoolId} />;

      case 'classes':
        return <ClassManagement schoolId={schoolId} />;

      case 'calendar':
        return <AcademicCalendar schoolId={schoolId} />;

      case 'finance':
        return <FeeVoteheadManagement schoolId={schoolId} />;

      case 'fee-structures':
        return <FeeStructureManagement schoolId={schoolId} />;

      case 'invoices':
        return <InvoiceManagement schoolId={schoolId} />;

      case 'payments':
        return <PaymentManagement schoolId={schoolId} />;

      case 'finance-overview':
        return <FinanceOverview schoolId={schoolId} />;

      case 'subjects':
        return <SubjectManagement schoolId={schoolId} />;

      case 'settings':
        return (
          <div className="rounded-xl border border-slate-200 bg-white p-8">
            <Settings className="mb-3 h-10 w-10 text-emerald-700" />

            <h2 className="text-xl font-semibold text-slate-900">
              School Settings
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              School configuration and preferences will be available here.
            </p>
          </div>
        );

      case 'dashboard':
      default:
        return renderDashboardHome();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-950 text-white transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Branding */}
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              EduCore<span className="text-emerald-400">AI</span>
            </h1>

            <p className="mt-1 text-xs text-slate-400">
              School Management System
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current school */}
        <div className="border-b border-white/10 px-6 py-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Current School
          </p>

          <p className="mt-1 truncate font-medium text-slate-200">
            {schoolName}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Main Menu
          </p>

          {navigationItems.map(item => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>

          <p className="mt-3 px-3 text-xs text-slate-600">
            EduCore AI · School Management
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-h-screen lg:pl-72">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div>
              <p className="text-sm font-semibold text-slate-800">
                {navigationItems.find(
                  item => item.id === activePage
                )?.label || 'Dashboard'}
              </p>

              <p className="hidden text-xs text-slate-400 sm:block">
                {schoolName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:block">
              School Administrator
            </span>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
              EA
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<PageLoading />}>
            {renderPage()}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
