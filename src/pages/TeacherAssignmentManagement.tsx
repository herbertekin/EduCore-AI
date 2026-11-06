
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  UserPlus,
  Users,
  BookOpen,
  Trash2,
  RefreshCw,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type Props = {
  schoolId: string;
};

type Teacher = {
  id: string;
  full_name: string;
  auth_user_id: string | null;
};

type SchoolClass = {
  id: string;
  class_name: string;
};

type Stream = {
  id: string;
  class_id: string;
  stream_name: string;
};

type Subject = {
  id: string;
  subject_code: string;
  subject_name: string;
};

type ClassSubject = {
  class_id: string;
  subject_id: string;
};

type Assignment = {
  id: string;
  teacher_id: string | null;
  teacher_user_id: string | null;
  class_id: string;
  stream_id: string | null;
  subject_id: string | null;
};

export default function TeacherAssignmentManagement({ schoolId }: Props) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [teacherId, setTeacherId] = useState('');
  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [assignmentType, setAssignmentType] =
    useState<'class' | 'subject'>('class');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [
        teacherResponse,
        classResponse,
        streamResponse,
        subjectResponse,
        classSubjectResponse,
        assignmentResponse,
      ] = await Promise.all([
        supabase
          .from('teachers')
          .select('id, full_name, auth_user_id')
          .eq('school_id', schoolId)
          .eq('status', 'active')
          .order('full_name'),

        supabase
          .from('classes')
          .select('id, class_name')
          .eq('school_id', schoolId)
          .order('class_name'),

        supabase
          .from('streams')
          .select('id, class_id, stream_name')
          .order('stream_name'),

        supabase
          .from('subjects')
          .select('id, subject_code, subject_name')
          .eq('school_id', schoolId)
          .order('subject_name'),

        supabase
          .from('class_subjects')
          .select('class_id, subject_id')
          .eq('school_id', schoolId),

        supabase
          .from('teacher_class_assignments')
          .select(
            'id, teacher_id, teacher_user_id, class_id, stream_id, subject_id'
          )
          .eq('school_id', schoolId),
      ]);

      if (teacherResponse.error) throw teacherResponse.error;
      if (classResponse.error) throw classResponse.error;
      if (streamResponse.error) throw streamResponse.error;
      if (subjectResponse.error) throw subjectResponse.error;
      if (classSubjectResponse.error) throw classSubjectResponse.error;
      if (assignmentResponse.error) throw assignmentResponse.error;

      setTeachers(teacherResponse.data ?? []);
      setClasses(classResponse.data ?? []);
      setStreams(streamResponse.data ?? []);
      setSubjects(subjectResponse.data ?? []);
      setClassSubjects(classSubjectResponse.data ?? []);
      setAssignments(assignmentResponse.data ?? []);
    } catch (err) {
      console.error('Error loading teacher assignments:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Could not load teacher data.'
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableStreams = useMemo(
    () => streams.filter(stream => stream.class_id === classId),
    [streams, classId]
  );

  const availableSubjects = useMemo(
    () =>
      classSubjects
        .filter(item => item.class_id === classId)
        .map(item =>
          subjects.find(subject => subject.id === item.subject_id)
        )
        .filter((subject): subject is Subject => Boolean(subject)),
    [classSubjects, classId, subjects]
  );

  const eligibleTeachers = teachers.filter(
    teacher => Boolean(teacher.auth_user_id)
  );

  const getTeacherName = (assignment: Assignment) => {
    const teacher = teachers.find(item =>
      assignment.teacher_id
        ? item.id === assignment.teacher_id
        : item.auth_user_id === assignment.teacher_user_id
    );

    return teacher?.full_name ?? 'Unknown Teacher';
  };

  const getClassName = (id: string) =>
    classes.find(item => item.id === id)?.class_name ?? 'Unknown Class';

  const getStreamName = (id: string | null) => {
    if (!id) return 'No stream assigned';

    return (
      streams.find(item => item.id === id)?.stream_name ??
      'Unknown Stream'
    );
  };

  const getSubjectName = (id: string | null) => {
    if (!id) return 'Class Teacher';

    const subject = subjects.find(item => item.id === id);

    return subject
      ? `${subject.subject_name} (${subject.subject_code})`
      : 'Unknown Subject';
  };

  const handleAssignmentTypeChange = (
    value: 'class' | 'subject'
  ) => {
    setAssignmentType(value);
    setSubjectId('');
    setError('');
    setSuccess('');
  };

  const handleClassChange = (value: string) => {
    setClassId(value);
    setStreamId('');
    setSubjectId('');
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!teacherId || !classId || !streamId) {
      setError('Please select a teacher, class and stream.');
      return;
    }

    if (assignmentType === 'subject' && !subjectId) {
      setError('Please select a subject.');
      return;
    }

    const selectedTeacher = eligibleTeachers.find(
      teacher => teacher.id === teacherId
    );

    if (!selectedTeacher?.auth_user_id) {
      setError(
        'This teacher needs login access enabled before receiving assignments.'
      );
      return;
    }

    const selectedStream = streams.find(
      stream =>
        stream.id === streamId &&
        stream.class_id === classId
    );

    if (!selectedStream) {
      setError(
        'The selected stream does not belong to this class.'
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error(
          'Your session has expired. Please sign in again.'
        );
      }

      // Check for an existing matching assignment.
      let duplicateQuery = supabase
        .from('teacher_class_assignments')
        .select('id')
        .eq('school_id', schoolId)
        .eq('teacher_id', selectedTeacher.id)
        .eq('class_id', classId)
        .eq('stream_id', streamId);

      duplicateQuery =
        assignmentType === 'subject'
          ? duplicateQuery.eq('subject_id', subjectId)
          : duplicateQuery.is('subject_id', null);

      const {
        data: duplicate,
        error: duplicateError,
      } = await duplicateQuery.maybeSingle();

      if (duplicateError) throw duplicateError;

      if (duplicate) {
        throw new Error(
          'This teacher already has this assignment for the selected class and stream.'
        );
      }

      const { error: insertError } = await supabase
        .from('teacher_class_assignments')
        .insert({
          school_id: schoolId,
          teacher_id: selectedTeacher.id,
          teacher_user_id: selectedTeacher.auth_user_id,
          class_id: classId,
          stream_id: streamId,
          subject_id:
            assignmentType === 'subject' ? subjectId : null,
          assigned_by: user.id,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('This assignment already exists.');
        }

        if (insertError.code === '23503') {
          throw new Error(
            'The selected teacher, class, stream or subject is invalid. Refresh and try again.'
          );
        }

        if (insertError.code === '23514') {
          throw new Error(
            'The assignment does not meet a database rule. Check the teacher login access.'
          );
        }

        throw new Error(insertError.message);
      }

      setSuccess('Teacher assignment created successfully.');

      setTeacherId('');
      setClassId('');
      setStreamId('');
      setSubjectId('');
      setAssignmentType('class');

      await loadData();
    } catch (err) {
      console.error('Error creating assignment:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Could not create assignment.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assignment: Assignment) => {
    const confirmed = window.confirm(
      'Are you sure you want to remove this teacher assignment?'
    );

    if (!confirmed) return;

    setError('');
    setSuccess('');
    setDeletingId(assignment.id);

    try {
      const { error: deleteError } = await supabase
        .from('teacher_class_assignments')
        .delete()
        .eq('id', assignment.id)
        .eq('school_id', schoolId);

      if (deleteError) throw deleteError;

      setSuccess('Teacher assignment removed.');

      await loadData();
    } catch (err) {
      console.error('Error removing assignment:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Could not remove assignment.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <RefreshCw className="h-7 w-7 animate-spin text-emerald-600" />
        <span className="ml-3 text-sm text-slate-500">
          Loading teacher data...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Teacher Assignment Management
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Assign teachers to specific classes, streams and subjects.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <Users className="mb-3 h-6 w-6 text-emerald-600" />
          <p className="text-2xl font-bold text-slate-900">
            {teachers.length}
          </p>
          <p className="text-sm text-slate-500">
            Registered Teachers
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <GraduationCap className="mb-3 h-6 w-6 text-blue-600" />
          <p className="text-2xl font-bold text-slate-900">
            {classes.length}
          </p>
          <p className="text-sm text-slate-500">
            School Classes
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <BookOpen className="mb-3 h-6 w-6 text-purple-600" />
          <p className="text-2xl font-bold text-slate-900">
            {assignments.length}
          </p>
          <p className="text-sm text-slate-500">
            Teacher Assignments
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="h-5 w-5" />
          {success}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2">
            <UserPlus className="h-6 w-6 text-emerald-700" />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              Assign a Teacher
            </h2>

            <p className="text-sm text-slate-500">
              Choose the teacher's teaching responsibility.
            </p>
          </div>
        </div>

        {teachers.length === 0 || classes.length === 0 ? (
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            {teachers.length === 0
              ? 'No active teachers are registered yet.'
              : 'Create at least one class before assigning teachers.'}
          </p>
        ) : eligibleTeachers.length === 0 ? (
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            No active teacher has login access yet. Enable login access first.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Select Teacher
                </label>

                <select
                  value={teacherId}
                  onChange={event => setTeacherId(event.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm"
                >
                  <option value="">Choose a teacher</option>

                  {teachers.map(teacher => (
                    <option
                      key={teacher.id}
                      value={teacher.id}
                      disabled={!teacher.auth_user_id}
                    >
                      {teacher.full_name}
                      {!teacher.auth_user_id
                        ? ' — No login yet'
                        : ''}
                    </option>
                  ))}
                </select>

                <p className="mt-1 text-xs text-slate-500">
                  Teachers without login access cannot yet receive assignments.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Assignment Type
                </label>

                <select
                  value={assignmentType}
                  onChange={event =>
                    handleAssignmentTypeChange(
                      event.target.value as 'class' | 'subject'
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm"
                >
                  <option value="class">Class Teacher</option>
                  <option value="subject">Subject Teacher</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Select Class
                </label>

                <select
                  value={classId}
                  onChange={event =>
                    handleClassChange(event.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm"
                >
                  <option value="">Choose a class</option>

                  {classes.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.class_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Select Stream
                </label>

                <select
                  value={streamId}
                  onChange={event => setStreamId(event.target.value)}
                  required
                  disabled={!classId || availableStreams.length === 0}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm disabled:bg-slate-100"
                >
                  <option value="">Choose a stream</option>

                  {availableStreams.map(stream => (
                    <option key={stream.id} value={stream.id}>
                      {stream.stream_name}
                    </option>
                  ))}
                </select>

                {classId && availableStreams.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    No streams exist for this class. Create a stream first.
                  </p>
                )}
              </div>

              {assignmentType === 'subject' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Select Subject
                  </label>

                  <select
                    value={subjectId}
                    onChange={event => setSubjectId(event.target.value)}
                    required
                    disabled={!classId || availableSubjects.length === 0}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm disabled:bg-slate-100"
                  >
                    <option value="">Choose a subject</option>

                    {availableSubjects.map(subject => (
                      <option key={subject.id} value={subject.id}>
                        {subject.subject_name} ({subject.subject_code})
                      </option>
                    ))}
                  </select>

                  {classId && availableSubjects.length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      No subjects have been assigned to this class yet.
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={
                saving ||
                !teacherId ||
                !classId ||
                !streamId ||
                (assignmentType === 'subject' && !subjectId)
              }
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {saving ? 'Saving Assignment...' : 'Save Assignment'}
            </button>
          </form>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="font-semibold text-slate-900">
              Existing Assignments
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Teachers and their assigned classes, streams and subjects.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {assignments.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />

            <p className="font-medium text-slate-700">
              No assignments yet
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Your teacher assignments will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-4">Teacher</th>
                  <th className="px-5 py-4">Class</th>
                  <th className="px-5 py-4">Stream</th>
                  <th className="px-5 py-4">Responsibility</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {assignments.map(assignment => (
                  <tr key={assignment.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {getTeacherName(assignment)}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {getClassName(assignment.class_id)}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {getStreamName(assignment.stream_id)}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          assignment.subject_id
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {getSubjectName(assignment.subject_id)}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDelete(assignment)}
                        disabled={deletingId === assignment.id}
                        aria-label="Remove assignment"
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
