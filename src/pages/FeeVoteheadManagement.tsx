
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Plus,
  Pencil,
  Power,
  RefreshCw,
  Wallet,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type FeeVotehead = {
  id: string;
  school_id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

type Props = {
  schoolId: string;
};

const emptyForm = {
  code: '',
  name: '',
  description: '',
};

export default function FeeVoteheadManagement({
  schoolId,
}: Props) {
  const [voteheads, setVoteheads] = useState<FeeVotehead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadVoteheads();
  }, [schoolId]);

  function clearMessages() {
    setMessage('');
    setErrorMessage('');
  }

  async function loadVoteheads() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('fee_voteheads')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      setVoteheads([]);
    } else {
      setVoteheads((data || []) as FeeVotehead[]);
    }

    setLoading(false);
  }

  function openCreateForm() {
    clearMessages();
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEditForm(votehead: FeeVotehead) {
    clearMessages();
    setEditingId(votehead.id);

    setForm({
      code: votehead.code,
      name: votehead.name,
      description: votehead.description || '',
    });

    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearMessages();

    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();
    const description = form.description.trim();

    if (!code || !name) {
      setErrorMessage('Please enter both a code and a name.');
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from('fee_voteheads')
        .update({
          code,
          name,
          description: description || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId)
        .eq('school_id', schoolId);

      if (error) {
        setErrorMessage(
          error.code === '23505'
            ? 'This votehead code already exists in your school.'
            : error.message
        );
      } else {
        setMessage('Fee votehead updated successfully.');
        closeForm();
        await loadVoteheads();
      }
    } else {
      const { error } = await supabase
        .from('fee_voteheads')
        .insert({
          school_id: schoolId,
          code,
          name,
          description: description || null,
          is_active: true,
        });

      if (error) {
        setErrorMessage(
          error.code === '23505'
            ? 'This votehead code already exists in your school.'
            : error.message
        );
      } else {
        setMessage('Fee votehead created successfully.');
        closeForm();
        await loadVoteheads();
      }
    }

    setSaving(false);
  }

  async function toggleStatus(votehead: FeeVotehead) {
    clearMessages();

    const { error } = await supabase
      .from('fee_voteheads')
      .update({
        is_active: !votehead.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', votehead.id)
      .eq('school_id', schoolId);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setMessage(
        votehead.is_active
          ? 'Votehead deactivated successfully.'
          : 'Votehead activated successfully.'
      );

      await loadVoteheads();
    }
  }

  const activeCount = voteheads.filter(
    (item) => item.is_active
  ).length;

  const inactiveCount = voteheads.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Fee Voteheads
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage the charges your school collects from students.
          </p>
        </div>

        <button
          onClick={loadVoteheads}
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

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-3 text-slate-500">
            <Wallet size={20} />
            <span className="text-sm">Total Voteheads</span>
          </div>
          <p className="mt-3 text-3xl font-bold">
            {voteheads.length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-slate-500">Active Voteheads</p>
          <p className="mt-3 text-3xl font-bold text-emerald-700">
            {activeCount}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-slate-500">Inactive Voteheads</p>
          <p className="mt-3 text-3xl font-bold text-slate-500">
            {inactiveCount}
          </p>
        </div>
      </div>

      {/* Add button */}
      <button
        onClick={openCreateForm}
        className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        <Plus size={18} />
        Add Fee Votehead
      </button>

      {/* Create / Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border bg-white p-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {editingId ? 'Edit Fee Votehead' : 'Create Fee Votehead'}
            </h2>

            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg p-2 hover:bg-slate-100"
              aria-label="Close form"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Votehead Code
              </label>

              <input
                required
                maxLength={30}
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value })
                }
                placeholder="e.g. TUITION"
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Votehead Name
              </label>

              <input
                required
                maxLength={100}
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                placeholder="e.g. Tuition Fees"
                className="w-full rounded-lg border p-3"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Description (Optional)
            </label>

            <textarea
              rows={3}
              maxLength={500}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Briefly describe this school charge..."
              className="w-full rounded-lg border p-3"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-white disabled:opacity-50"
            >
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Save Changes'
                  : 'Create Votehead'}
            </button>

            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border px-5 py-2.5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Votehead Directory */}
      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b p-5">
          <h2 className="font-bold">Votehead Directory</h2>
          <p className="mt-1 text-sm text-slate-500">
            All fee categories registered for your school.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">
            Loading voteheads...
          </div>
        ) : voteheads.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No fee voteheads registered yet. Add your first votehead.
          </div>
        ) : (
          <div className="divide-y">
            {voteheads.map((votehead) => (
              <div
                key={votehead.id}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">
                      {votehead.name}
                    </h3>

                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      {votehead.code}
                    </span>

                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        votehead.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {votehead.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {votehead.description || 'No description provided.'}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => openEditForm(votehead)}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <Pencil size={15} />
                    Edit
                  </button>

                  <button
                    onClick={() => toggleStatus(votehead)}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <Power size={15} />
                    {votehead.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
