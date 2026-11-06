
import { useEffect, useState } from 'react';
import {
  Plus,
  School,
  Users,
  Layers,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type ClassRecord = {
  id: string;
  school_id: string;
  curriculum: 'CBC' | '8-4-4';
  class_name: string;
  class_level: number;
  streams?: {
    id: string;
    stream_name: string;
  }[];
};

type ClassManagementProps = {
  schoolId: string;
};

export default function ClassManagement({
  schoolId,
}: ClassManagementProps) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingClass, setSavingClass] = useState(false);
  const [savingStream, setSavingStream] = useState(false);

  const [showClassForm, setShowClassForm] = useState(false);
  const [showStreamForm, setShowStreamForm] = useState(false);

  const [classForm, setClassForm] = useState({
    class_name: '',
    curriculum: 'CBC' as 'CBC' | '8-4-4',
    class_level: '',
  });

  const [streamForm, setStreamForm] = useState({
    class_id: '',
    stream_name: '',
  });

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadClasses();
  }, [schoolId]);

  async function loadClasses() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('classes')
      .select(`
        id,
        school_id,
        curriculum,
        class_name,
        class_level,
        streams (
          id,
          stream_name
        )
      `)
      .eq('school_id', schoolId)
      .order('class_level', { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      setClasses([]);
    } else {
      setClasses((data || []) as ClassRecord[]);
    }

    setLoading(false);
  }

  async function createClass(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSavingClass(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('classes')
      .insert({
        school_id: schoolId,
        class_name: classForm.class_name.trim(),
        curriculum: classForm.curriculum,
        class_level: Number(classForm.class_level),
      });

    if (error) {
      setErrorMessage(
        error.code === '23505'
          ? 'This class already exists for the selected curriculum.'
          : error.message
      );
    } else {
      setMessage('Class created successfully.');

      setClassForm({
        class_name: '',
        curriculum: 'CBC',
        class_level: '',
      });

      setShowClassForm(false);
      await loadClasses();
    }

    setSavingClass(false);
  }

  async function createStream(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSavingStream(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('streams')
      .insert({
        class_id: streamForm.class_id,
        stream_name: streamForm.stream_name.trim(),
      });

    if (error) {
      setErrorMessage(
        error.code === '23505'
          ? 'This stream already exists in the selected class.'
          : error.message
      );
    } else {
      setMessage('Stream created successfully.');

      setStreamForm({
        class_id: '',
        stream_name: '',
      });

      setShowStreamForm(false);
      await loadClasses();
    }

    setSavingStream(false);
  }

  async function deleteClass(classId: string) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this class?'
    );

    if (!confirmed) return;

    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', classId)
      .eq('school_id', schoolId);

    if (error) {
      setErrorMessage(
        'Could not delete this class. It may have existing student enrolments or other linked records.'
      );
    } else {
      setMessage('Class deleted successfully.');
      await loadClasses();
    }
  }

  async function deleteStream(streamId: string) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this stream?'
    );

    if (!confirmed) return;

    setMessage('');
    setErrorMessage('');

    const { error } = await supabase
      .from('streams')
      .delete()
      .eq('id', streamId);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setMessage('Stream deleted successfully.');
      await loadClasses();
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Class & Stream Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Create classes, organize streams and manage school structures.
          </p>
        </div>

        <button
          onClick={loadClasses}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
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

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-3">
            <School className="text-blue-600" />
            <span className="text-sm text-slate-500">Total Classes</span>
          </div>

          <p className="mt-3 text-3xl font-bold">
            {classes.length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-3">
            <Users className="text-green-600" />
            <span className="text-sm text-slate-500">Total Streams</span>
          </div>

          <p className="mt-3 text-3xl font-bold">
            {classes.reduce(
              (total, item) => total + (item.streams?.length || 0),
              0
            )}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-3">
            <Layers className="text-purple-600" />
            <span className="text-sm text-slate-500">Curricula</span>
          </div>

          <p className="mt-3 text-3xl font-bold">
            {new Set(classes.map((item) => item.curriculum)).size}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">

        <button
          onClick={() => {
            setShowClassForm(!showClassForm);
            setShowStreamForm(false);
          }}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          <Plus size={18} />
          Add Class
        </button>

        <button
          onClick={() => {
            setShowStreamForm(!showStreamForm);
            setShowClassForm(false);
          }}
          disabled={classes.length === 0}
          className="flex items-center gap-2 rounded-lg border border-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={18} />
          Add Stream
        </button>
      </div>

      {/* Create Class Form */}
      {showClassForm && (
        <form
          onSubmit={createClass}
          className="space-y-4 rounded-xl border bg-white p-6"
        >
          <h2 className="text-lg font-bold">Register New Class</h2>

          <div className="grid gap-4 sm:grid-cols-2">

            <div>
              <label className="mb-1 block text-sm font-medium">
                Class Name
              </label>

              <input
                required
                value={classForm.class_name}
                onChange={(e) =>
                  setClassForm({
                    ...classForm,
                    class_name: e.target.value,
                  })
                }
                placeholder="e.g. Grade 7 or Form 1"
                className="w-full rounded-lg border p-3 outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Curriculum
              </label>

              <select
                value={classForm.curriculum}
                onChange={(e) =>
                  setClassForm({
                    ...classForm,
                    curriculum: e.target.value as 'CBC' | '8-4-4',
                  })
                }
                className="w-full rounded-lg border p-3 outline-none focus:border-emerald-600"
              >
                <option value="CBC">CBC</option>
                <option value="8-4-4">8-4-4</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Class Level
              </label>

              <input
                type="number"
                required
                min="1"
                max="20"
                value={classForm.class_level}
                onChange={(e) =>
                  setClassForm({
                    ...classForm,
                    class_level: e.target.value,
                  })
                }
                placeholder="e.g. 7"
                className="w-full rounded-lg border p-3 outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              disabled={savingClass}
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-white disabled:opacity-50"
            >
              {savingClass ? 'Saving...' : 'Save Class'}
            </button>

            <button
              type="button"
              onClick={() => setShowClassForm(false)}
              className="rounded-lg border px-5 py-2.5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Create Stream Form */}
      {showStreamForm && (
        <form
          onSubmit={createStream}
          className="space-y-4 rounded-xl border bg-white p-6"
        >
          <h2 className="text-lg font-bold">Register New Stream</h2>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Select Class
            </label>

            <select
              required
              value={streamForm.class_id}
              onChange={(e) =>
                setStreamForm({
                  ...streamForm,
                  class_id: e.target.value,
                })
              }
              className="w-full rounded-lg border p-3"
            >
              <option value="">Choose a class</option>

              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.class_name} ({item.curriculum})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Stream Name
            </label>

            <input
              required
              value={streamForm.stream_name}
              onChange={(e) =>
                setStreamForm({
                  ...streamForm,
                  stream_name: e.target.value,
                })
              }
              placeholder="e.g. East, West, North"
              className="w-full rounded-lg border p-3"
            />
          </div>

          <div className="flex gap-3">
            <button
              disabled={savingStream}
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-white disabled:opacity-50"
            >
              {savingStream ? 'Saving...' : 'Save Stream'}
            </button>

            <button
              type="button"
              onClick={() => setShowStreamForm(false)}
              className="rounded-lg border px-5 py-2.5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Class Directory */}
      <div className="overflow-hidden rounded-xl border bg-white">

        <div className="border-b p-5">
          <h2 className="font-bold text-slate-900">
            Registered Classes
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Classes and their assigned streams.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">
            Loading classes...
          </div>
        ) : classes.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No classes registered yet. Click Add Class to get started.
          </div>
        ) : (
          <div className="divide-y">
            {classes.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">
                      {item.class_name}
                    </h3>

                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      {item.curriculum}
                    </span>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      Level {item.class_level}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.streams?.length ? (
                      item.streams.map((stream) => (
                        <span
                          key={stream.id}
                          className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
                        >
                          {stream.stream_name}

                          <button
                            type="button"
                            onClick={() => deleteStream(stream.id)}
                            title="Delete stream"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={13} />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">
                        No streams assigned
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => deleteClass(item.id)}
                  className="flex items-center gap-2 self-start rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 sm:self-center"
                >
                  <Trash2 size={15} />
                  Delete Class
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
