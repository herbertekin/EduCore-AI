import { useState, type FormEvent } from 'react'
import { ArrowLeft, CheckCircle2, GraduationCap } from 'lucide-react'
import { supabase } from './lib/supabase'

type School = {
  id: string
  name: string
  school_code: string
  county: string | null
}

type Props = {
  onBack: () => void
  onSchoolAdded: (school: School) => void
}

export default function AddSchool({ onBack, onSchoolAdded }: Props) {
  const [form, setForm] = useState({
    name: '', county: '', subCounty: '', address: '', phone: '', email: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)

  const update = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }))

  const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'
  const labelClass = 'mb-2 block text-sm font-semibold text-slate-700'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!form.name.trim()) {
      setError('Enter the school name.')
      return
    }

    setLoading(true)
    try {
      const { data: schoolId, error: rpcError } = await supabase.rpc(
        'add_school_for_current_admin',
        {
          p_name: form.name.trim(),
          p_county: form.county.trim() || null,
          p_sub_county: form.subCounty.trim() || null,
          p_address: form.address.trim() || null,
          p_phone: form.phone.trim() || null,
          p_email: form.email.trim().toLowerCase() || null,
        }
      )

      if (rpcError) throw rpcError
      if (!schoolId) throw new Error('The school was created but its ID was not returned. Please refresh and check your school list before trying again.')

      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('id, name, school_code, county')
        .eq('id', schoolId)
        .single()

      if (schoolError) throw schoolError
      onSchoolAdded(school as School)
      setCreated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add this school. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (created) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 size={34} className="text-emerald-700" />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold text-slate-900">School added successfully</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{form.name} is now linked to your existing administrator account. You can select it from your available portals.</p>
          <button type="button" onClick={onBack} className="mt-7 w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">Return to my schools</button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-700">
          <ArrowLeft size={17} /> Back to my schools
        </button>
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
          <div className="bg-emerald-900 px-6 py-8 text-white sm:px-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><GraduationCap size={28} /></div>
              <div>
                <h1 className="text-2xl font-extrabold">Add another school</h1>
                <p className="mt-1 text-sm text-emerald-100">Use your existing administrator account</p>
              </div>
            </div>
            <p className="mt-5 max-w-xl text-sm leading-6 text-emerald-100">The new school will be linked to the account you are currently signed in with. No new login is created.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-10">
            <div>
              <label className={labelClass}>School name *</label>
              <input required value={form.name} onChange={(e) => update('name', e.target.value)} className={inputClass} placeholder="Enter the official school name" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelClass}>County</label>
                <input value={form.county} onChange={(e) => update('county', e.target.value)} className={inputClass} placeholder="e.g. Bungoma" />
              </div>
              <div>
                <label className={labelClass}>Sub-county</label>
                <input value={form.subCounty} onChange={(e) => update('subCounty', e.target.value)} className={inputClass} placeholder="Enter sub-county" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>School address / location</label>
                <input value={form.address} onChange={(e) => update('address', e.target.value)} className={inputClass} placeholder="School physical location" />
              </div>
              <div>
                <label className={labelClass}>School phone</label>
                <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass} placeholder="School contact number" />
              </div>
              <div>
                <label className={labelClass}>School email</label>
                <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={inputClass} placeholder="School email address" />
              </div>
            </div>
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            <div className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">Your existing account will become an administrator of this school. Other schools and their records remain separate.</div>
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-emerald-700 px-6 py-4 font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Adding school...' : 'Add school'}</button>
          </form>
        </div>
      </div>
    </main>
  )
}
