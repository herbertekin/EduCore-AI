
import { useState, type FormEvent } from 'react';
import {
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type Props = {
  schoolId: string;
};

export default function TeacherRegistration({ schoolId }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [staffNumber, setStaffNumber] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    const name = fullName.trim();
    const teacherEmail = email.trim().toLowerCase();
    const teacherPhone = phone.trim();
    const staffNo = staffNumber.trim();

    if (!schoolId) {
      setError('School information is missing. Please refresh and try again.');
      return;
    }

    if (name.length < 2 || name.length > 100) {
      setError('Full name must be between 2 and 100 characters.');
      return;
    }

    if (
      teacherEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacherEmail)
    ) {
      setError('Please enter a valid email address.');
      return;
    }

    if (teacherPhone.length > 30) {
      setError('Phone number is too long.');
      return;
    }

    if (staffNo.length > 50) {
      setError('Staff number must not exceed 50 characters.');
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const { error: insertError } = await supabase
        .from('teachers')
        .insert({
          school_id: schoolId,
          full_name: name,
          email: teacherEmail || null,
          phone: teacherPhone || null,
          staff_number: staffNo || null,
          created_by: authData.user.id,
          status: 'active',
        });

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error(
            'A teacher with this email address or staff number already exists in this school.'
          );
        }

        throw insertError;
      }

      setSuccess(
        'Teacher registered successfully. No login invitation has been sent.'
      );

      setFullName('');
      setEmail('');
      setPhone('');
      setStaffNumber('');
    } catch (err) {
      console.error('Teacher registration error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to register teacher. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Register a Teacher
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Add a teacher to your school's staff records.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-100 p-3 text-emerald-700">
            <UserPlus size={22} />
          </div>

          <div>
            <h3 className="font-semibold text-slate-900">
              Teacher Information
            </h3>

            <p className="text-sm text-slate-500">
              Enter the teacher's employment and contact details.
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Full name *
          </label>

          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="e.g. Jane Wanjiku"
            required
            minLength={2}
            maxLength={100}
            disabled={loading}
            autoComplete="name"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Email address
          </label>

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teacher@example.com"
            maxLength={254}
            disabled={loading}
            autoComplete="email"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
          />

          <p className="mt-1 text-xs text-slate-500">
            An email address will be needed if you later enable login access.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Phone number
          </label>

          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="e.g. 07XXXXXXXX"
            maxLength={30}
            disabled={loading}
            autoComplete="tel"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Staff number
          </label>

          <input
            type="text"
            value={staffNumber}
            onChange={(event) => setStaffNumber(event.target.value)}
            placeholder="e.g. TCH-001"
            maxLength={50}
            disabled={loading}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Registering teacher...
            </>
          ) : (
            <>
              <UserPlus size={18} />
              Register Teacher
            </>
          )}
        </button>

        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <strong>Important:</strong> Registration only creates a staff
          record. It does not create a login account or send an email
          invitation. Login access can be enabled separately later.
        </div>
      </form>
    </div>
  );
}
