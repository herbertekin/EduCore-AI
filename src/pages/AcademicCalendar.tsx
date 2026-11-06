
import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Plus,
  RefreshCw,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type AcademicYear = {
  id: string;
  school_id: string;
  year_name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  terms?: Term[];
};

type Term = {
  id: string;
  academic_year_id: string;
  term_number: number;
  start_date: string;
  end_date: string;
};

type Props = {
  schoolId: string;
};

export default function AcademicCalendar({ schoolId }: Props) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingYear, setSavingYear] = useState(false);
  const [savingTerm, setSavingTerm] = useState(false);
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [editingTermId, setEditingTermId] = useState<string | null>(null);

  const [showYearForm, setShowYearForm] = useState(false);
  const [showTermForm, setShowTermForm] = useState(false);

  const [yearForm, setYearForm] = useState({
    year_name: '',
    start_date: '',
    end_date: '',
  });

  const [termForm, setTermForm] = useState({
    academic_year_id: '',
    term_number: '1',
    start_date: '',
    end_date: '',
  });

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadAcademicYears();
  }, [schoolId]);

  async function loadAcademicYears() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('academic_years')
      .select(`
        id,
        school_id,
        year_name,
        start_date,
        end_date,
        is_active,
        terms (
          id,
          academic_year_id,
          term_number,
          start_date,
          end_date
        )
      `)
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setYears([]);
    } else {
      setYears((data || []) as AcademicYear[]);
    }

    setLoading(false);
  }

  function clearMessages() {
    setMessage('');
    setErrorMessage('');
  }

  async function createAcademicYear(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    clearMessages();

    if (yearForm.end_date <= yearForm.start_date) {
      setErrorMessage('The end date must be after the start date.');
      return;
    }

    const overlaps = years.some(
      (year) =>
        year.id !== editingYearId &&
        yearForm.start_date <= year.end_date &&
        yearForm.end_date >= year.start_date
    );

    if (overlaps) {
      setErrorMessage(
        'These dates overlap an existing academic year. Please check the calendar.'
      );
      return;
    }

    setSavingYear(true);

    if (editingYearId) {
      const editedYear = years.find((year) => year.id === editingYearId);
      const hasTermOutsideNewDates = (editedYear?.terms || []).some(
        (term) =>
          term.start_date < yearForm.start_date ||
          term.end_date > yearForm.end_date
      );

      if (hasTermOutsideNewDates) {
        setErrorMessage(
          'The new academic-year dates must still contain all existing terms. Edit the term dates first if necessary.'
        );
        setSavingYear(false);
        return;
      }
    }

    const payload = {
      year_name: yearForm.year_name.trim(),
      start_date: yearForm.start_date,
      end_date: yearForm.end_date,
    };

    const { error } = editingYearId
      ? await supabase
          .from('academic_years')
          .update(payload)
          .eq('id', editingYearId)
          .eq('school_id', schoolId)
      : await supabase
          .from('academic_years')
          .insert({ school_id: schoolId, ...payload, is_active: false });

    if (error) {
      setErrorMessage(
        error.code === '23505'
          ? 'An academic year with this name already exists.'
          : error.message
      );
    } else {
      setMessage(
        editingYearId ? 'Academic year updated successfully.' : 'Academic year created successfully.'
      );

      setYearForm({
        year_name: '',
        start_date: '',
        end_date: '',
      });

      setShowYearForm(false);
      setEditingYearId(null);
      await loadAcademicYears();
    }

    setSavingYear(false);
  }

  async function activateAcademicYear(yearId: string) {
    clearMessages();

    // This is a temporary implementation using two requests.
    // We'll replace it with one atomic database function before production.

    const { error: deactivateError } = await supabase
      .from('academic_years')
      .update({ is_active: false })
      .eq('school_id', schoolId);

    if (deactivateError) {
      setErrorMessage(deactivateError.message);
      return;
    }

    const { error: activateError } = await supabase
      .from('academic_years')
      .update({ is_active: true })
      .eq('id', yearId)
      .eq('school_id', schoolId);

    if (activateError) {
      setErrorMessage(activateError.message);
    } else {
      setMessage('Academic year activated successfully.');
      await loadAcademicYears();
    }
  }

  async function createTerm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearMessages();

    if (!termForm.academic_year_id) {
      setErrorMessage('Please select an academic year.');
      return;
    }

    if (termForm.end_date <= termForm.start_date) {
      setErrorMessage('The term end date must be after its start date.');
      return;
    }

    const selectedYear = years.find(
      (year) => year.id === termForm.academic_year_id
    );

    if (!selectedYear) {
      setErrorMessage('Selected academic year could not be found.');
      return;
    }

    if (
      termForm.start_date < selectedYear.start_date ||
      termForm.end_date > selectedYear.end_date
    ) {
      setErrorMessage(
        'Term dates must fall within the selected academic year.'
      );
      return;
    }

    const existingTerms = selectedYear.terms || [];

    const overlaps = existingTerms.some(
      (term) =>
        term.id !== editingTermId &&
        termForm.start_date <= term.end_date &&
        termForm.end_date >= term.start_date
    );

    if (overlaps) {
      setErrorMessage(
        'These dates overlap an existing term in this academic year.'
      );
      return;
    }

    setSavingTerm(true);

    const termPayload = {
      academic_year_id: termForm.academic_year_id,
      term_number: Number(termForm.term_number),
      start_date: termForm.start_date,
      end_date: termForm.end_date,
    };

    const { error } = editingTermId
      ? await supabase.from('terms').update(termPayload).eq('id', editingTermId)
      : await supabase.from('terms').insert(termPayload);

    if (error) {
      setErrorMessage(
        error.code === '23505'
          ? 'This term number already exists for the selected academic year.'
          : error.message
      );
    } else {
      setMessage(
        editingTermId ? 'Term updated successfully.' : 'Term created successfully.'
      );

      setTermForm({
        academic_year_id: '',
        term_number: '1',
        start_date: '',
        end_date: '',
      });

      setShowTermForm(false);
      setEditingTermId(null);
      await loadAcademicYears();
    }

    setSavingTerm(false);
  }

  function startEditingYear(year: AcademicYear) {
    clearMessages();
    setEditingYearId(year.id);
    setYearForm({
      year_name: year.year_name,
      start_date: year.start_date,
      end_date: year.end_date,
    });
    setShowYearForm(true);
    setShowTermForm(false);
  }

  function startEditingTerm(year: AcademicYear, term: Term) {
    clearMessages();
    setEditingTermId(term.id);
    setTermForm({
      academic_year_id: year.id,
      term_number: String(term.term_number),
      start_date: term.start_date,
      end_date: term.end_date,
    });
    setShowTermForm(true);
    setShowYearForm(false);
  }

  function cancelYearForm() {
    setShowYearForm(false);
    setEditingYearId(null);
    setYearForm({ year_name: '', start_date: '', end_date: '' });
  }

  function cancelTermForm() {
    setShowTermForm(false);
    setEditingTermId(null);
    setTermForm({
      academic_year_id: '',
      term_number: '1',
      start_date: '',
      end_date: '',
    });
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Academic Calendar
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage academic years, terms and school schedules.
          </p>
        </div>

        <button
          onClick={loadAcademicYears}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Messages */}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">

        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-3 text-slate-500">
            <CalendarDays size={20} />
            <span className="text-sm">Academic Years</span>
          </div>

          <p className="mt-3 text-3xl font-bold">{years.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-3 text-slate-500">
            <CheckCircle2 size={20} />
            <span className="text-sm">Active Year</span>
          </div>

          <p className="mt-3 text-xl font-bold">
            {years.find((year) => year.is_active)?.year_name || 'None'}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-3 text-slate-500">
            <BookOpen size={20} />
            <span className="text-sm">Total Terms</span>
          </div>

          <p className="mt-3 text-3xl font-bold">
            {years.reduce(
              (total, year) => total + (year.terms?.length || 0),
              0
            )}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => {
            if (showYearForm && !editingYearId) {
              cancelYearForm();
            } else {
              cancelTermForm();
              setEditingYearId(null);
              setYearForm({ year_name: '', start_date: '', end_date: '' });
              setShowYearForm(true);
            }
          }}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          <Plus size={18} />
          Add Academic Year
        </button>

        <button
          onClick={() => {
            if (showTermForm && !editingTermId) {
              cancelTermForm();
            } else {
              cancelYearForm();
              setEditingTermId(null);
              setTermForm({ academic_year_id: '', term_number: '1', start_date: '', end_date: '' });
              setShowTermForm(true);
            }
          }}
          disabled={years.length === 0}
          className="flex items-center gap-2 rounded-lg border border-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-700 disabled:opacity-50"
        >
          <Plus size={18} />
          Add Term
        </button>
      </div>

      {/* Academic year form */}
      {showYearForm && (
        <form
          onSubmit={createAcademicYear}
          className="space-y-4 rounded-xl border bg-white p-6"
        >
          <h2 className="text-lg font-bold">{editingYearId ? 'Edit Academic Year' : 'Create Academic Year'}</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Year Name
              </label>

              <input
                required
                value={yearForm.year_name}
                onChange={(e) =>
                  setYearForm({
                    ...yearForm,
                    year_name: e.target.value,
                  })
                }
                placeholder="e.g. 2027"
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Start Date
              </label>

              <input
                type="date"
                required
                value={yearForm.start_date}
                onChange={(e) =>
                  setYearForm({
                    ...yearForm,
                    start_date: e.target.value,
                  })
                }
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                End Date
              </label>

              <input
                type="date"
                required
                value={yearForm.end_date}
                onChange={(e) =>
                  setYearForm({
                    ...yearForm,
                    end_date: e.target.value,
                  })
                }
                min={yearForm.start_date || undefined}
                className="w-full rounded-lg border p-3"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              disabled={savingYear}
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-white disabled:opacity-50"
            >
              {savingYear ? 'Saving...' : editingYearId ? 'Save Changes' : 'Save Academic Year'}
            </button>

            <button
              type="button"
              onClick={cancelYearForm}
              className="rounded-lg border px-5 py-2.5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Term form */}
      {showTermForm && (
        <form
          onSubmit={createTerm}
          className="space-y-4 rounded-xl border bg-white p-6"
        >
          <h2 className="text-lg font-bold">{editingTermId ? 'Edit Term' : 'Create Academic Term'}</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Academic Year
              </label>

              <select
                required
                value={termForm.academic_year_id}
                onChange={(e) =>
                  setTermForm({
                    ...termForm,
                    academic_year_id: e.target.value,
                  })
                }
                className="w-full rounded-lg border p-3"
              >
                <option value="">Select academic year</option>

                {years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.year_name}
                    {year.is_active ? ' (Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Term Number
              </label>

              <select
                required
                value={termForm.term_number}
                onChange={(e) =>
                  setTermForm({
                    ...termForm,
                    term_number: e.target.value,
                  })
                }
                className="w-full rounded-lg border p-3"
              >
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Start Date
              </label>

              <input
                type="date"
                required
                value={termForm.start_date}
                onChange={(e) =>
                  setTermForm({
                    ...termForm,
                    start_date: e.target.value,
                  })
                }
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                End Date
              </label>

              <input
                type="date"
                required
                value={termForm.end_date}
                onChange={(e) =>
                  setTermForm({
                    ...termForm,
                    end_date: e.target.value,
                  })
                }
                min={termForm.start_date || undefined}
                className="w-full rounded-lg border p-3"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              disabled={savingTerm}
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-white disabled:opacity-50"
            >
              {savingTerm ? 'Saving...' : editingTermId ? 'Save Changes' : 'Save Term'}
            </button>

            <button
              type="button"
              onClick={cancelTermForm}
              className="rounded-lg border px-5 py-2.5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Academic year directory */}
      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-5">
          <h2 className="font-bold">Academic Years & Terms</h2>
          <p className="mt-1 text-sm text-slate-500">
            Your school's academic calendar.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">
            Loading academic calendar...
          </div>
        ) : years.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No academic years registered yet.
          </div>
        ) : (
          <div className="divide-y">
            {years.map((year) => (
              <div key={year.id} className="space-y-4 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">
                        {year.year_name}
                      </h3>

                      {year.is_active && (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                          Active
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {year.start_date} — {year.end_date}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => startEditingYear(year)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit Year
                    </button>
                    {!year.is_active && (
                      <button
                        onClick={() => activateAcademicYear(year.id)}
                        className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                      >
                        Set as Active
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[1, 2, 3].map((number) => {
                    const term = year.terms?.find(
                      (item) => item.term_number === number
                    );

                    return (
                      <div
                        key={number}
                        className="rounded-lg border bg-slate-50 p-4"
                      >
                        <p className="font-semibold">
                          Term {number}
                        </p>

                        {term ? (
                          <>
                            <p className="mt-2 text-xs text-slate-500">
                              {term.start_date} — {term.end_date}
                            </p>
                            <button
                              type="button"
                              onClick={() => startEditingTerm(year, term)}
                              className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
                            >
                              Edit Term
                            </button>
                          </>
                        ) : (
                          <p className="mt-2 text-xs text-slate-400">
                            Not configured
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
