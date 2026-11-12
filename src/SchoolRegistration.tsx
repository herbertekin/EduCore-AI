// import { useState, type FormEvent } from 'react'
// import { ArrowLeft, CheckCircle2, GraduationCap } from 'lucide-react'
// import { supabase } from './lib/supabase'

// type Props = { onBack: () => void }

// type RegistrationForm = {
//   fullName: string
//   adminPhone: string
//   email: string
//   password: string
//   confirmPassword: string
//   schoolName: string
//   county: string
//   subCounty: string
//   address: string
//   schoolPhone: string
//   schoolEmail: string
// }

// const initialForm: RegistrationForm = {
//   fullName: '', adminPhone: '', email: '', password: '', confirmPassword: '',
//   schoolName: '', county: '', subCounty: '', address: '', schoolPhone: '', schoolEmail: '',
// }

// export default function SchoolRegistration({ onBack }: Props) {
//   const [form, setForm] = useState<RegistrationForm>(initialForm)
//   const [loading, setLoading] = useState(false)
//   const [message, setMessage] = useState('')
//   const [success, setSuccess] = useState(false)

//   const updateField = (field: keyof RegistrationForm, value: string) => {
//     setForm((current) => ({ ...current, [field]: value }))
//   }

//   const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'
//   const labelClass = 'mb-2 block text-sm font-semibold text-slate-700'

//   const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
//     event.preventDefault()
//     setMessage('')
//     setSuccess(false)

//     if (form.password.length < 8) {
//       setMessage('Your password must contain at least 8 characters.')
//       return
//     }
//     if (form.password !== form.confirmPassword) {
//       setMessage('Your passwords do not match.')
//       return
//     }
//     if (!form.fullName.trim() || !form.schoolName.trim()) {
//       setMessage('Please enter your full name and school name.')
//       return
//     }

//     setLoading(true)
//     try {
//       const email = form.email.trim().toLowerCase()
//       const { data, error } = await supabase.auth.signUp({
//         email,
//         password: form.password,
//         options: {
//           emailRedirectTo: window.location.origin,
//           data: {
//             registration_type: 'school_admin',
//             full_name: form.fullName.trim(),
//             phone: form.adminPhone.trim(),
//             school_name: form.schoolName.trim(),
//             county: form.county.trim(),
//             sub_county: form.subCounty.trim(),
//             address: form.address.trim(),
//             school_phone: form.schoolPhone.trim(),
//             school_email: (form.schoolEmail.trim() || email).toLowerCase(),
//           },
//         },
//       })
//       if (error) throw error

//       if (data.user && data.user.identities?.length === 0) {
//         throw new Error('An account with this email may already exist. Try signing in or use another email address.')
//       }

//       if (data.session) {
//         // App.tsx observes the auth event and loads the new administrator membership.
//         setMessage('Your account has been created. Opening your school portal...')
//       } else {
//         setSuccess(true)
//         setMessage(`We have sent a confirmation email to ${email}. Confirm your email, then return here and sign in. Your school and administrator membership are created by the database signup trigger.`)
//       }
//     } catch (error) {
//       setMessage(error instanceof Error ? error.message : 'Registration failed. Please try again.')
//     } finally {
//       setLoading(false)
//     }
//   }

//   if (success) {
//     return (
//       <main className="min-h-screen bg-slate-50 px-4 py-10">
//         <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-lg">
//           <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
//             <CheckCircle2 size={34} className="text-emerald-700" />
//           </div>
//           <h1 className="mt-5 text-2xl font-extrabold text-slate-900">Check your email</h1>
//           <p className="mt-4 text-sm leading-7 text-slate-600">{message}</p>
//           <button type="button" onClick={onBack} className="mt-7 w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">
//             Return to home
//           </button>
//         </div>
//       </main>
//     )
//   }

//   return (
//     <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
//       <div className="mx-auto max-w-3xl">
//         <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-700">
//           <ArrowLeft size={17} /> Back to home
//         </button>

//         <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
//           <div className="bg-emerald-900 px-6 py-8 text-white sm:px-10">
//             <div className="flex items-center gap-3">
//               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><GraduationCap size={28} /></div>
//               <div>
//                 <h1 className="text-2xl font-extrabold">Register your school</h1>
//                 <p className="mt-1 text-sm text-emerald-100">Get started with EduCore AI</p>
//               </div>
//             </div>
//             <p className="mt-5 max-w-xl text-sm leading-6 text-emerald-100">Create your school account and become its first administrator.</p>
//           </div>

//           <form onSubmit={handleSubmit} className="space-y-8 p-6 sm:p-10">
//             <section>
//               <h2 className="text-lg font-extrabold text-slate-900">Administrator information</h2>
//               <p className="mb-5 mt-1 text-sm text-slate-500">These details will be used for your administrator account.</p>
//               <div className="grid gap-5 sm:grid-cols-2">
//                 <div className="sm:col-span-2">
//                   <label className={labelClass}>Full name *</label>
//                   <input required autoComplete="name" value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} className={inputClass} placeholder="Your full name" />
//                 </div>
//                 <div>
//                   <label className={labelClass}>Administrator phone</label>
//                   <input type="tel" autoComplete="tel" value={form.adminPhone} onChange={(e) => updateField('adminPhone', e.target.value)} className={inputClass} placeholder="07XX XXX XXX" />
//                 </div>
//                 <div>
//                   <label className={labelClass}>Email address *</label>
//                   <input type="email" required autoComplete="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className={inputClass} placeholder="you@example.com" />
//                 </div>
//                 <div>
//                   <label className={labelClass}>Password *</label>
//                   <input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => updateField('password', e.target.value)} className={inputClass} placeholder="At least 8 characters" />
//                 </div>
//                 <div>
//                   <label className={labelClass}>Confirm password *</label>
//                   <input type="password" required minLength={8} autoComplete="new-password" value={form.confirmPassword} onChange={(e) => updateField('confirmPassword', e.target.value)} className={inputClass} placeholder="Enter password again" />
//                 </div>
//               </div>
//             </section>

//             <div className="border-t border-slate-100" />

//             <section>
//               <h2 className="text-lg font-extrabold text-slate-900">School information</h2>
//               <p className="mb-5 mt-1 text-sm text-slate-500">Tell us about the school you are registering.</p>
//               <div className="grid gap-5 sm:grid-cols-2">
//                 <div className="sm:col-span-2">
//                   <label className={labelClass}>School name *</label>
//                   <input required value={form.schoolName} onChange={(e) => updateField('schoolName', e.target.value)} className={inputClass} placeholder="Enter the official school name" />
//                 </div>
//                 <div>
//                   <label className={labelClass}>County</label>
//                   <input value={form.county} onChange={(e) => updateField('county', e.target.value)} className={inputClass} placeholder="e.g. Bungoma" />
//                 </div>
//                 <div>
//                   <label className={labelClass}>Sub-county</label>
//                   <input value={form.subCounty} onChange={(e) => updateField('subCounty', e.target.value)} className={inputClass} placeholder="Enter sub-county" />
//                 </div>
//                 <div className="sm:col-span-2">
//                   <label className={labelClass}>School address / location</label>
//                   <input value={form.address} onChange={(e) => updateField('address', e.target.value)} className={inputClass} placeholder="School physical location" />
//                 </div>
//                 <div>
//                   <label className={labelClass}>School phone</label>
//                   <input type="tel" value={form.schoolPhone} onChange={(e) => updateField('schoolPhone', e.target.value)} className={inputClass} placeholder="School contact number" />
//                 </div>
//                 <div>
//                   <label className={labelClass}>School email</label>
//                   <input type="email" value={form.schoolEmail} onChange={(e) => updateField('schoolEmail', e.target.value)} className={inputClass} placeholder="Optional school email" />
//                 </div>
//               </div>
//             </section>

//             {message && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>}
//             <div className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">By registering, you will become the administrator of the school account you create.</div>
//             <button type="submit" disabled={loading} className="w-full rounded-xl bg-emerald-700 px-6 py-4 font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
//               {loading ? 'Creating your school account...' : 'Register school'}
//             </button>
//             <p className="text-center text-xs text-slate-400">EduCore AI · Smart Schools. Brighter Futures.</p>
//           </form>
//         </div>
//       </div>
//     </main>
//   )
// }


type Props = {
  onBack: () => void
}

export default function SchoolRegistration({ onBack }: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <span className="text-3xl text-emerald-700">🏫</span>
        </div>

        <h1 className="mt-5 text-2xl font-extrabold text-slate-900">
          School registration is restricted
        </h1>

        <p className="mt-4 text-sm leading-7 text-slate-600">
          New schools can only be registered by the authorised EduCore AI
          platform owner. Please contact the platform administrator for
          assistance.
        </p>

        <button
          type="button"
          onClick={onBack}
          className="mt-7 w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white transition hover:bg-emerald-800"
        >
          Return to home
        </button>
      </div>
    </main>
  )
}
