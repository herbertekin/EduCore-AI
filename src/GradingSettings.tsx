import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Pencil,
  X,
  AlertCircle,
} from 'lucide-react'
import { supabase } from './lib/supabase'

type Props = {
  schoolId: string
  schoolName: string
  onBack: () => void
}

type GradingScale = {
  id: string
  school_id: string
  scale_name: string
  curriculum: string | null
  grade_level: string | null
  grading_mode: 'numerical' | 'cbe' | 'both'
  is_default: boolean
  created_at?: string
}

type GradingBand = {
  id: string
  grading_scale_id: string
  minimum_percentage: number
  maximum_percentage: number
  grade_label: string | null
  performance_level: 'EE' | 'ME' | 'AE' | 'BE' | null
  description: string | null
}

const emptyScale = {
  scale_name: '',
  curriculum: 'CBC',
  grade_level: '',
  grading_mode: 'both' as GradingScale['grading_mode'],
}

const emptyBand = {
  minimum_percentage: '0',
  maximum_percentage: '100',
  grade_label: '',
  performance_level: '' as '' | 'EE' | 'ME' | 'AE' | 'BE',
  description: '',
}

export default function GradingSettings({ schoolId, schoolName, onBack }: Props) {
  const [scales, setScales] = useState<GradingScale[]>([])
  const [bands, setBands] = useState<GradingBand[]>([])
  const [selectedScaleId, setSelectedScaleId] = useState('')
  const [scaleForm, setScaleForm] = useState(emptyScale)
  const [bandForm, setBandForm] = useState(emptyBand)
  const [editingScaleId, setEditingScaleId] = useState<string | null>(null)
  const [editingBandId, setEditingBandId] = useState<string | null>(null)
  const [showScaleForm, setShowScaleForm] = useState(false)
  const [showBandForm, setShowBandForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadScales = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('grading_scales')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
      setScales([])
      setBands([])
      setLoading(false)
      return
    }

    const rows = (data ?? []) as GradingScale[]
    setScales(rows)

    const currentId =
      rows.find((scale) => scale.id === selectedScaleId)?.id ??
      rows.find((scale) => scale.is_default)?.id ??
      rows[0]?.id ??
      ''

    setSelectedScaleId(currentId)

    if (currentId) {
      const { data: bandRows, error: bandError } = await supabase
        .from('grading_scale_bands')
        .select('*')
        .eq('grading_scale_id', currentId)
        .order('minimum_percentage', { ascending: false })

      if (bandError) {
        setError(bandError.message)
        setBands([])
      } else {
        setBands((bandRows ?? []) as GradingBand[])
      }
    } else {
      setBands([])
    }
    setLoading(false)
  }, [schoolId, selectedScaleId])

  useEffect(() => {
    void loadScales()
  }, [loadScales])

  const loadBandsFor = async (scaleId: string) => {
    setSelectedScaleId(scaleId)
    setError('')
    const { data, error: queryError } = await supabase
      .from('grading_scale_bands')
      .select('*')
      .eq('grading_scale_id', scaleId)
      .order('minimum_percentage', { ascending: false })

    if (queryError) {
      setError(queryError.message)
      setBands([])
      return
    }
    setBands((data ?? []) as GradingBand[])
  }

  const saveScale = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!scaleForm.scale_name.trim()) {
      setError('Enter a name for this grading scale.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    const payload = {
      school_id: schoolId,
      scale_name: scaleForm.scale_name.trim(),
      curriculum: scaleForm.curriculum.trim() || null,
      grade_level: scaleForm.grade_level.trim() || null,
      grading_mode: scaleForm.grading_mode,
    }

    const result = editingScaleId
      ? await supabase.from('grading_scales').update(payload).eq('id', editingScaleId).eq('school_id', schoolId)
      : await supabase.from('grading_scales').insert(payload)

    if (result.error) {
      setError(result.error.message)
    } else {
      setSuccess(editingScaleId ? 'Grading scale updated.' : 'Grading scale created.')
      setScaleForm(emptyScale)
      setEditingScaleId(null)
      setShowScaleForm(false)
      await loadScales()
    }
    setSaving(false)
  }

  const editScale = (scale: GradingScale) => {
    setEditingScaleId(scale.id)
    setScaleForm({
      scale_name: scale.scale_name,
      curriculum: scale.curriculum ?? '',
      grade_level: scale.grade_level ?? '',
      grading_mode: scale.grading_mode,
    })
    setShowScaleForm(true)
    setError('')
    setSuccess('')
  }

  const deleteScale = async (scale: GradingScale) => {
    if (!window.confirm(`Delete "${scale.scale_name}" and its grading bands?`)) return
    setError('')
    setSuccess('')
    const { error: deleteError } = await supabase
      .from('grading_scales')
      .delete()
      .eq('id', scale.id)
      .eq('school_id', schoolId)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      setSuccess('Grading scale deleted.')
      await loadScales()
    }
  }

  const makeDefault = async (scale: GradingScale) => {
    setSaving(true)
    setError('')
    setSuccess('')
    const { error: clearError } = await supabase
      .from('grading_scales')
      .update({ is_default: false })
      .eq('school_id', schoolId)

    if (clearError) {
      setError(clearError.message)
      setSaving(false)
      return
    }

    const { error: setErrorResult } = await supabase
      .from('grading_scales')
      .update({ is_default: true })
      .eq('id', scale.id)
      .eq('school_id', schoolId)

    if (setErrorResult) {
      setError(setErrorResult.message)
    } else {
      setSuccess(`${scale.scale_name} is now the default grading scale.`)
      await loadScales()
    }
    setSaving(false)
  }

  const saveBand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedScaleId) {
      setError('Create or select a grading scale first.')
      return
    }

    const minimum = Number(bandForm.minimum_percentage)
    const maximum = Number(bandForm.maximum_percentage)

    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum < 0 ||
      maximum > 100 ||
      minimum > maximum
    ) {
      setError('Enter a valid percentage range between 0 and 100.')
      return
    }

    const overlaps = bands.some((band) => {
      if (band.id === editingBandId) return false
      return minimum <= Number(band.maximum_percentage) &&
        maximum >= Number(band.minimum_percentage)
    })

    if (overlaps) {
      setError('This percentage range overlaps an existing band. Adjust the range first.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    const payload = {
      grading_scale_id: selectedScaleId,
      minimum_percentage: minimum,
      maximum_percentage: maximum,
      grade_label: bandForm.grade_label.trim() || null,
      performance_level: bandForm.performance_level || null,
      description: bandForm.description.trim() || null,
    }

    const result = editingBandId
      ? await supabase.from('grading_scale_bands').update(payload).eq('id', editingBandId).eq('grading_scale_id', selectedScaleId)
      : await supabase.from('grading_scale_bands').insert(payload)

    if (result.error) {
      setError(result.error.message)
    } else {
      setSuccess(editingBandId ? 'Grading band updated.' : 'Grading band added.')
      setBandForm(emptyBand)
      setEditingBandId(null)
      setShowBandForm(false)
      await loadBandsFor(selectedScaleId)
    }
    setSaving(false)
  }

  const editBand = (band: GradingBand) => {
    setEditingBandId(band.id)
    setBandForm({
      minimum_percentage: String(band.minimum_percentage),
      maximum_percentage: String(band.maximum_percentage),
      grade_label: band.grade_label ?? '',
      performance_level: band.performance_level ?? '',
      description: band.description ?? '',
    })
    setShowBandForm(true)
    setError('')
    setSuccess('')
  }

  const deleteBand = async (band: GradingBand) => {
    if (!window.confirm('Delete this grading band?')) return
    setError('')
    setSuccess('')
    const { error: deleteError } = await supabase
      .from('grading_scale_bands')
      .delete()
      .eq('id', band.id)
      .eq('grading_scale_id', selectedScaleId)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      setSuccess('Grading band deleted.')
      await loadBandsFor(selectedScaleId)
    }
  }

  const cancelScaleForm = () => {
    setScaleForm(emptyScale)
    setEditingScaleId(null)
    setShowScaleForm(false)
  }

  const cancelBandForm = () => {
    setBandForm(emptyBand)
    setEditingBandId(null)
    setShowBandForm(false)
  }

  const selectedScale = scales.find((scale) => scale.id === selectedScaleId)

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              className="mt-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Go back"
            >
              <ArrowLeft size={19} />
            </button>
            <div>
              <p className="text-sm font-medium text-emerald-700">{schoolName}</p>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Grading Settings</h1>
              <p className="mt-1 text-sm text-slate-500">Configure grading scales and their percentage bands.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadScales()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}
        {success && (
          <div role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> <span>{success}</span>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Grading scales</h2>
              <p className="mt-1 text-sm text-slate-500">Create scales for the curricula and grade levels used by your school.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                cancelScaleForm()
                setShowScaleForm(true)
                setError('')
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
            >
              <Plus size={17} /> Add grading scale
            </button>
          </div>

          {showScaleForm && (
            <form onSubmit={saveScale} className="mt-5 grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Scale name *
                <input required value={scaleForm.scale_name} onChange={(e) => setScaleForm({ ...scaleForm, scale_name: e.target.value })} placeholder="e.g. CBC Junior School" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-600" />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Curriculum
                <input value={scaleForm.curriculum} onChange={(e) => setScaleForm({ ...scaleForm, curriculum: e.target.value })} placeholder="CBC, 8-4-4, etc." className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-600" />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Grade level
                <input value={scaleForm.grade_level} onChange={(e) => setScaleForm({ ...scaleForm, grade_level: e.target.value })} placeholder="e.g. Grade 7–9" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-600" />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Grading mode
                <select value={scaleForm.grading_mode} onChange={(e) => setScaleForm({ ...scaleForm, grading_mode: e.target.value as GradingScale['grading_mode'] })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-600">
                  <option value="numerical">Numerical</option>
                  <option value="cbe">CBE</option>
                  <option value="both">Numerical and CBE</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={16} /> {saving ? 'Saving...' : editingScaleId ? 'Update scale' : 'Save scale'}</button>
                <button type="button" onClick={cancelScaleForm} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700"><X size={16} /> Cancel</button>
              </div>
            </form>
          )}

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading grading scales...</p>
          ) : scales.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center">
              <p className="font-bold text-slate-700">No grading scales created yet</p>
              <p className="mt-1 text-sm text-slate-500">Add a grading scale to start configuring grade bands.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {scales.map((scale) => (
                <article key={scale.id} className={`rounded-xl border p-4 ${selectedScaleId === scale.id ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => void loadBandsFor(scale.id)} className="min-w-0 flex-1 text-left">
                      <span className="flex flex-wrap items-center gap-2 font-extrabold text-slate-900">
                        {scale.scale_name}
                        {scale.is_default && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">Default</span>}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">{scale.curriculum || 'No curriculum'}{scale.grade_level ? ` • ${scale.grade_level}` : ''} • {scale.grading_mode}</span>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => editScale(scale)} aria-label="Edit scale" className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-emerald-700"><Pencil size={16} /></button>
                      <button type="button" onClick={() => void deleteScale(scale)} aria-label="Delete scale" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <button type="button" onClick={() => void loadBandsFor(scale.id)} className="text-xs font-bold text-emerald-800 hover:underline">Manage bands</button>
                    {!scale.is_default && <button type="button" disabled={saving} onClick={() => void makeDefault(scale)} className="text-xs font-bold text-slate-600 hover:text-emerald-700">Set as default</button>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {selectedScale && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Selected scale</p>
                <h2 className="mt-1 text-lg font-extrabold text-slate-900">{selectedScale.scale_name} — Grade bands</h2>
                <p className="mt-1 text-sm text-slate-500">Percentage boundaries must be between 0 and 100 and must not overlap.</p>
              </div>
              <button type="button" onClick={() => { cancelBandForm(); setShowBandForm(true); setError('') }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">
                <Plus size={17} /> Add grade band
              </button>
            </div>

            {showBandForm && (
              <form onSubmit={saveBand} className="mt-5 grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm font-semibold text-slate-700">Minimum percentage *
                  <input required type="number" min="0" max="100" step="0.01" value={bandForm.minimum_percentage} onChange={(e) => setBandForm({ ...bandForm, minimum_percentage: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" />
                </label>
                <label className="text-sm font-semibold text-slate-700">Maximum percentage *
                  <input required type="number" min="0" max="100" step="0.01" value={bandForm.maximum_percentage} onChange={(e) => setBandForm({ ...bandForm, maximum_percentage: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" />
                </label>
                <label className="text-sm font-semibold text-slate-700">Grade label
                  <input value={bandForm.grade_label} onChange={(e) => setBandForm({ ...bandForm, grade_label: e.target.value })} placeholder="e.g. A, B, EE1" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" />
                </label>
                <label className="text-sm font-semibold text-slate-700">CBE performance level
                  <select value={bandForm.performance_level} onChange={(e) => setBandForm({ ...bandForm, performance_level: e.target.value as typeof bandForm.performance_level })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                    <option value="">Not specified</option>
                    <option value="EE">Exceeding Expectations (EE)</option>
                    <option value="ME">Meeting Expectations (ME)</option>
                    <option value="AE">Approaching Expectations (AE)</option>
                    <option value="BE">Below Expectations (BE)</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Description
                  <input value={bandForm.description} onChange={(e) => setBandForm({ ...bandForm, description: e.target.value })} placeholder="Optional explanation" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" />
                </label>
                <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
                  <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={16} /> {saving ? 'Saving...' : editingBandId ? 'Update band' : 'Save band'}</button>
                  <button type="button" onClick={cancelBandForm} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700"><X size={16} /> Cancel</button>
                </div>
              </form>
            )}

            {bands.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">No grade bands have been added to this scale yet.</div>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr><th className="px-4 py-3">Range</th><th className="px-4 py-3">Grade</th><th className="px-4 py-3">CBE level</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bands.map((band) => (
                      <tr key={band.id} className="text-slate-700">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold">{band.minimum_percentage}% – {band.maximum_percentage}%</td>
                        <td className="px-4 py-3 font-bold">{band.grade_label || '—'}</td>
                        <td className="px-4 py-3">{band.performance_level || '—'}</td>
                        <td className="px-4 py-3">{band.description || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => editBand(band)} aria-label="Edit band" className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"><Pencil size={16} /></button>
                            <button type="button" onClick={() => void deleteBand(band)} aria-label="Delete band" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
