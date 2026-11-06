import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react'

import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  RefreshCw,
  Star,
  GraduationCap,
  Layers,
} from 'lucide-react'

import { supabase } from '../lib/supabase'

type Props = {
  schoolId: string
  schoolName: string
  onBack: () => void
}

type GradingMode = 'numerical' | 'cbe' | 'both'

type PerformanceLevel = 'EE' | 'ME' | 'AE' | 'BE'

type GradingScale = {
  id: string
  school_id: string
  scale_name: string
  curriculum: string | null
  grade_level: string | null
  grading_mode: GradingMode
  is_default: boolean
  created_at: string
}

type GradingBand = {
  id: string
  grading_scale_id: string
  minimum_percentage: number
  maximum_percentage: number
  grade_label: string | null
  performance_level: PerformanceLevel | null
  description: string | null
}

type ScaleForm = {
  scale_name: string
  curriculum: string
  grade_level: string
  grading_mode: GradingMode
  is_default: boolean
}

type BandForm = {
  minimum_percentage: string
  maximum_percentage: string
  grade_label: string
  performance_level: PerformanceLevel | ''
  description: string
}

const emptyScaleForm: ScaleForm = {
  scale_name: '',
  curriculum: 'CBC',
  grade_level: '',
  grading_mode: 'both',
  is_default: false,
}

const emptyBandForm: BandForm = {
  minimum_percentage: '',
  maximum_percentage: '',
  grade_label: '',
  performance_level: '',
  description: '',
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700'

export default function GradingSettings({
  schoolId,
  schoolName,
  onBack,
}: Props) {
  const [scales, setScales] = useState<GradingScale[]>([])
  const [bands, setBands] = useState<GradingBand[]>([])

  const [selectedScaleId, setSelectedScaleId] = useState('')
  const [editingScaleId, setEditingScaleId] = useState<string | null>(null)
  const [editingBandId, setEditingBandId] = useState<string | null>(null)

  const [scaleForm, setScaleForm] = useState<ScaleForm>(emptyScaleForm)
  const [bandForm, setBandForm] = useState<BandForm>(emptyBandForm)

  const [loading, setLoading] = useState(true)
  const [loadingBands, setLoadingBands] = useState(false)
  const [savingScale, setSavingScale] = useState(false)
  const [savingBand, setSavingBand] = useState(false)

  const [showScaleForm, setShowScaleForm] = useState(false)
  const [showBandForm, setShowBandForm] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const selectedScale =
    scales.find((scale) => scale.id === selectedScaleId) ?? null

  const showMessage = (message: string) => {
    setSuccess(message)
    setError('')
  }

  const showError = (message: string) => {
    setError(message)
    setSuccess('')
  }

  const fetchScales = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('grading_scales')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      showError(fetchError.message)
      setLoading(false)
      return
    }

    const records = (data ?? []) as GradingScale[]

    setScales(records)

    setSelectedScaleId((current) => {
      if (current && records.some((scale) => scale.id === current)) {
        return current
      }

      const defaultScale = records.find((scale) => scale.is_default)

      return defaultScale?.id ?? records[0]?.id ?? ''
    })

    setLoading(false)
  }, [schoolId])

  const fetchBands = useCallback(async (scaleId: string) => {
    if (!scaleId) {
      setBands([])
      return
    }

    setLoadingBands(true)

    const { data, error: fetchError } = await supabase
      .from('grading_scale_bands')
      .select('*')
      .eq('grading_scale_id', scaleId)
      .order('minimum_percentage', { ascending: false })

    if (fetchError) {
      showError(fetchError.message)
      setBands([])
    } else {
      setBands((data ?? []) as GradingBand[])
    }

    setLoadingBands(false)
  }, [])

  useEffect(() => {
    void fetchScales()
  }, [fetchScales])

  useEffect(() => {
    void fetchBands(selectedScaleId)
  }, [selectedScaleId, fetchBands])

  // Sets one scale as the school's default.
  const setDefaultScale = async (scaleId: string) => {
    const { error: resetError } = await supabase
      .from('grading_scales')
      .update({ is_default: false })
      .eq('school_id', schoolId)

    if (resetError) {
      throw new Error(resetError.message)
    }

    const { error: updateError } = await supabase
      .from('grading_scales')
      .update({ is_default: true })
      .eq('id', scaleId)
      .eq('school_id', schoolId)

    if (updateError) {
      throw new Error(updateError.message)
    }
  }

  const resetScaleForm = () => {
    setScaleForm(emptyScaleForm)
    setEditingScaleId(null)
    setShowScaleForm(false)
  }

  const resetBandForm = () => {
    setBandForm(emptyBandForm)
    setEditingBandId(null)
    setShowBandForm(false)
  }

  const handleNewScale = () => {
    setError('')
    setSuccess('')
    setScaleForm(emptyScaleForm)
    setEditingScaleId(null)
    setShowScaleForm(true)
  }

  const handleEditScale = (scale: GradingScale) => {
    setError('')
    setSuccess('')

    setScaleForm({
      scale_name: scale.scale_name,
      curriculum: scale.curriculum ?? '',
      grade_level: scale.grade_level ?? '',
      grading_mode: scale.grading_mode,
      is_default: scale.is_default,
    })

    setEditingScaleId(scale.id)
    setShowScaleForm(true)
  }

  const handleSaveScale = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!scaleForm.scale_name.trim()) {
      showError('Enter a name for the grading scale.')
      return
    }

    setSavingScale(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        scale_name: scaleForm.scale_name.trim(),
        curriculum: scaleForm.curriculum.trim() || null,
        grade_level: scaleForm.grade_level.trim() || null,
        grading_mode: scaleForm.grading_mode,
        // Default selection is applied separately below.
        is_default: false,
      }

      let savedScaleId = editingScaleId

      if (editingScaleId) {
        const { error: updateError } = await supabase
          .from('grading_scales')
          .update(payload)
          .eq('id', editingScaleId)
          .eq('school_id', schoolId)

        if (updateError) {
          throw new Error(updateError.message)
        }
      } else {
        const { data, error: insertError } = await supabase
          .from('grading_scales')
          .insert({
            ...payload,
            school_id: schoolId,
          })
          .select('id')
          .single()

        if (insertError) {
          throw new Error(insertError.message)
        }

        savedScaleId = data.id
      }

      if (!savedScaleId) {
        throw new Error('The grading scale could not be identified.')
      }

      if (scaleForm.is_default) {
        await setDefaultScale(savedScaleId)
      } else {
        const { error: defaultError } = await supabase
          .from('grading_scales')
          .update({ is_default: false })
          .eq('id', savedScaleId)
          .eq('school_id', schoolId)

        if (defaultError) {
          throw new Error(defaultError.message)
        }
      }

      setSelectedScaleId(savedScaleId)
      resetScaleForm()
      await fetchScales()

      showMessage(
        editingScaleId
          ? 'Grading scale updated successfully.'
          : 'Grading scale created successfully.',
      )
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : 'Unable to save the grading scale.',
      )
    } finally {
      setSavingScale(false)
    }
  }

  const handleDeleteScale = async (scale: GradingScale) => {
    const confirmed = window.confirm(
      `Delete "${scale.scale_name}" and all its grading bands?`,
    )

    if (!confirmed) return

    setError('')
    setSuccess('')

    const { error: deleteError } = await supabase
      .from('grading_scales')
      .delete()
      .eq('id', scale.id)
      .eq('school_id', schoolId)

    if (deleteError) {
      showError(deleteError.message)
      return
    }

    if (selectedScaleId === scale.id) {
      setSelectedScaleId('')
      setBands([])
    }

    if (editingScaleId === scale.id) {
      resetScaleForm()
    }

    await fetchScales()
    showMessage('Grading scale deleted successfully.')
  }

  const handleNewBand = () => {
    setError('')
    setSuccess('')
    setBandForm(emptyBandForm)
    setEditingBandId(null)
    setShowBandForm(true)
  }

  const handleEditBand = (band: GradingBand) => {
    setError('')
    setSuccess('')

    setBandForm({
      minimum_percentage: String(band.minimum_percentage),
      maximum_percentage: String(band.maximum_percentage),
      grade_label: band.grade_label ?? '',
      performance_level: band.performance_level ?? '',
      description: band.description ?? '',
    })

    setEditingBandId(band.id)
    setShowBandForm(true)
  }

  const handleSaveBand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedScale) {
      showError('Select a grading scale first.')
      return
    }

    if (
      bandForm.minimum_percentage.trim() === '' ||
      bandForm.maximum_percentage.trim() === ''
    ) {
      showError('Enter both the minimum and maximum percentages.')
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
      showError(
        'Percentages must be between 0 and 100, and the minimum cannot exceed the maximum.',
      )
      return
    }

    const requiresGrade =
      selectedScale.grading_mode === 'numerical' ||
      selectedScale.grading_mode === 'both'

    const requiresPerformance =
      selectedScale.grading_mode === 'cbe' ||
      selectedScale.grading_mode === 'both'

    if (requiresGrade && !bandForm.grade_label.trim()) {
      showError('Enter a grade label for this band.')
      return
    }

    if (requiresPerformance && !bandForm.performance_level) {
      showError('Select a CBE performance level for this band.')
      return
    }

    const overlaps = bands.some((band) => {
      if (band.id === editingBandId) return false

      return (
        minimum <= Number(band.maximum_percentage) &&
        maximum >= Number(band.minimum_percentage)
      )
    })

    if (overlaps) {
      showError(
        'This percentage range overlaps an existing band. Adjust the range before saving.',
      )
      return
    }

    setSavingBand(true)
    setError('')
    setSuccess('')

    const payload = {
      grading_scale_id: selectedScale.id,
      minimum_percentage: minimum,
      maximum_percentage: maximum,
      grade_label: requiresGrade
        ? bandForm.grade_label.trim()
        : bandForm.grade_label.trim() || null,
      performance_level: requiresPerformance
        ? bandForm.performance_level
        : bandForm.performance_level || null,
      description: bandForm.description.trim() || null,
    }

    try {
      if (editingBandId) {
        const { error: updateError } = await supabase
          .from('grading_scale_bands')
          .update(payload)
          .eq('id', editingBandId)
          .eq('grading_scale_id', selectedScale.id)

        if (updateError) {
          throw new Error(updateError.message)
        }
      } else {
        const { error: insertError } = await supabase
          .from('grading_scale_bands')
          .insert(payload)

        if (insertError) {
          throw new Error(insertError.message)
        }
      }

      resetBandForm()
      await fetchBands(selectedScale.id)

      showMessage(
        editingBandId
          ? 'Grading band updated successfully.'
          : 'Grading band added successfully.',
      )
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : 'Unable to save the grading band.',
      )
    } finally {
      setSavingBand(false)
    }
  }

  const handleDeleteBand = async (band: GradingBand) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this grading band?',
    )

    if (!confirmed) return

    const { error: deleteError } = await supabase
      .from('grading_scale_bands')
      .delete()
      .eq('id', band.id)
      .eq('grading_scale_id', band.grading_scale_id)

    if (deleteError) {
      showError(deleteError.message)
      return
    }

    if (editingBandId === band.id) {
      resetBandForm()
    }

    await fetchBands(band.grading_scale_id)
    showMessage('Grading band deleted successfully.')
  }

  const formatMode = (mode: GradingMode) => {
    if (mode === 'numerical') return 'Numerical grading'
    if (mode === 'cbe') return 'CBE performance levels'
    return 'Numerical + CBE'
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
              title="Go back"
            >
              <ArrowLeft size={20} />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <GraduationCap className="text-emerald-700" size={24} />
                <h1 className="text-2xl font-bold text-slate-900">
                  Grading Settings
                </h1>
              </div>
              <p className="mt-1 text-sm text-slate-500">{schoolName}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void fetchScales()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <CircleAlert size={19} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {/* Explanation */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 text-emerald-700" size={21} />
            <div>
              <h2 className="font-semibold text-emerald-900">
                Configure your school's grading system
              </h2>
              <p className="mt-1 text-sm text-emerald-800">
                Create grading scales and define the percentage ranges,
                grade labels and CBE performance levels used by your school.
                These settings will be used by the grading and reporting
                features once those features are connected.
              </p>
            </div>
          </div>
        </div>

        {/* Scale section */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Grading scales
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Create and manage grading systems for your school.
              </p>
            </div>

            <button
              type="button"
              onClick={handleNewScale}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              <Plus size={17} />
              New grading scale
            </button>
          </div>

          {showScaleForm && (
            <form
              onSubmit={handleSaveScale}
              className="border-b border-emerald-100 bg-emerald-50/50 p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">
                  {editingScaleId ? 'Edit grading scale' : 'Create grading scale'}
                </h3>

                <button
                  type="button"
                  onClick={resetScaleForm}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-white"
                  title="Close form"
                >
                  <X size={19} />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Scale name *</label>
                  <input
                    className={inputClass}
                    value={scaleForm.scale_name}
                    onChange={(event) =>
                      setScaleForm({
                        ...scaleForm,
                        scale_name: event.target.value,
                      })
                    }
                    placeholder="e.g. CBC Junior School Scale"
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Curriculum</label>
                  <select
                    className={inputClass}
                    value={scaleForm.curriculum}
                    onChange={(event) =>
                      setScaleForm({
                        ...scaleForm,
                        curriculum: event.target.value,
                      })
                    }
                  >
                    <option value="">Select curriculum</option>
                    <option value="CBC">CBC</option>
                    <option value="8-4-4">8-4-4</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Grade level</label>
                  <input
                    className={inputClass}
                    value={scaleForm.grade_level}
                    onChange={(event) =>
                      setScaleForm({
                        ...scaleForm,
                        grade_level: event.target.value,
                      })
                    }
                    placeholder="e.g. Junior School, Senior School"
                  />
                </div>

                <div>
                  <label className={labelClass}>Grading mode *</label>
                  <select
                    className={inputClass}
                    value={scaleForm.grading_mode}
                    onChange={(event) =>
                      setScaleForm({
                        ...scaleForm,
                        grading_mode: event.target.value as GradingMode,
                      })
                    }
                  >
                    <option value="numerical">Numerical grading</option>
                    <option value="cbe">CBE performance levels</option>
                    <option value="both">Numerical + CBE</option>
                  </select>
                </div>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={scaleForm.is_default}
                  onChange={(event) =>
                    setScaleForm({
                      ...scaleForm,
                      is_default: event.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-emerald-700"
                />
                Make this the default grading scale for the school
              </label>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={savingScale}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  <Save size={16} />
                  {savingScale ? 'Saving...' : 'Save grading scale'}
                </button>

                <button
                  type="button"
                  onClick={resetScaleForm}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="p-5">
            {loading ? (
              <div className="py-10 text-center text-sm text-slate-500">
                Loading grading scales...
              </div>
            ) : scales.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center">
                <Layers className="mx-auto mb-3 text-slate-400" size={34} />
                <p className="font-medium text-slate-700">
                  No grading scales created yet
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Create your first grading scale to begin configuring grades.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {scales.map((scale) => (
                  <div
                    key={scale.id}
                    className={`rounded-xl border p-4 transition ${
                      selectedScaleId === scale.id
                        ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-200'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedScaleId(scale.id)
                        resetBandForm()
                        setError('')
                        setSuccess('')
                      }}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-slate-900">
                          {scale.scale_name}
                        </h3>

                        {scale.is_default && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                            <Star size={12} />
                            Default
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {scale.curriculum || 'No curriculum specified'}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {scale.grade_level || 'All grade levels'}
                      </p>

                      <p className="mt-3 text-xs font-medium text-emerald-700">
                        {formatMode(scale.grading_mode)}
                      </p>
                    </button>

                    <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => handleEditScale(scale)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDeleteScale(scale)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Grading bands */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Grading bands
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Define the percentage ranges and their corresponding grades.
              </p>
            </div>

            <button
              type="button"
              onClick={handleNewBand}
              disabled={!selectedScale}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={17} />
              Add grading band
            </button>
          </div>

          {!selectedScale ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Select or create a grading scale before adding grading bands.
            </div>
          ) : (
            <>
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                <p className="text-sm text-slate-600">
                  Selected scale:{' '}
                  <span className="font-semibold text-slate-900">
                    {selectedScale.scale_name}
                  </span>
                </p>
              </div>

              {showBandForm && (
                <form
                  onSubmit={handleSaveBand}
                  className="border-b border-emerald-100 bg-emerald-50/50 p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">
                      {editingBandId ? 'Edit grading band' : 'Add grading band'}
                    </h3>

                    <button
                      type="button"
                      onClick={resetBandForm}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-white"
                      title="Close form"
                    >
                      <X size={19} />
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className={labelClass}>
                        Minimum percentage *
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        className={inputClass}
                        value={bandForm.minimum_percentage}
                        onChange={(event) =>
                          setBandForm({
                            ...bandForm,
                            minimum_percentage: event.target.value,
                          })
                        }
                        placeholder="e.g. 80"
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClass}>
                        Maximum percentage *
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        className={inputClass}
                        value={bandForm.maximum_percentage}
                        onChange={(event) =>
                          setBandForm({
                            ...bandForm,
                            maximum_percentage: event.target.value,
                          })
                        }
                        placeholder="e.g. 100"
                        required
                      />
                    </div>

                    {(selectedScale.grading_mode === 'numerical' ||
                      selectedScale.grading_mode === 'both') && (
                      <div>
                        <label className={labelClass}>Grade label *</label>
                        <input
                          className={inputClass}
                          value={bandForm.grade_label}
                          onChange={(event) =>
                            setBandForm({
                              ...bandForm,
                              grade_label: event.target.value,
                            })
                          }
                          placeholder="e.g. A, B, C, 1, 2"
                          required
                        />
                      </div>
                    )}

                    {(selectedScale.grading_mode === 'cbe' ||
                      selectedScale.grading_mode === 'both') && (
                      <div>
                        <label className={labelClass}>
                          CBE performance level *
                        </label>
                        <select
                          className={inputClass}
                          value={bandForm.performance_level}
                          onChange={(event) =>
                            setBandForm({
                              ...bandForm,
                              performance_level: event.target.value as
                                | PerformanceLevel
                                | '',
                            })
                          }
                          required
                        >
                          <option value="">Select performance level</option>
                          <option value="EE">EE — Exceeding Expectations</option>
                          <option value="ME">ME — Meeting Expectations</option>
                          <option value="AE">AE — Approaching Expectations</option>
                          <option value="BE">BE — Below Expectations</option>
                        </select>
                      </div>
                    )}

                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className={labelClass}>Description</label>
                      <input
                        className={inputClass}
                        value={bandForm.description}
                        onChange={(event) =>
                          setBandForm({
                            ...bandForm,
                            description: event.target.value,
                          })
                        }
                        placeholder="Optional explanation of this grading band"
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={savingBand}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      <Save size={16} />
                      {savingBand ? 'Saving...' : 'Save grading band'}
                    </button>

                    <button
                      type="button"
                      onClick={resetBandForm}
                      className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="p-5">
                {loadingBands ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    Loading grading bands...
                  </div>
                ) : bands.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center">
                    <Layers className="mx-auto mb-3 text-slate-400" size={32} />
                    <p className="font-medium text-slate-700">
                      No grading bands configured
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Add percentage ranges to this grading scale.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-3">Percentage range</th>
                          <th className="px-4 py-3">Grade</th>
                          <th className="px-4 py-3">CBE level</th>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {bands.map((band) => (
                          <tr key={band.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {Number(band.minimum_percentage).toFixed(2)}% –{' '}
                              {Number(band.maximum_percentage).toFixed(2)}%
                            </td>

                            <td className="px-4 py-3 text-slate-700">
                              {band.grade_label || '—'}
                            </td>

                            <td className="px-4 py-3">
                              {band.performance_level ? (
                                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                  {band.performance_level}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>

                            <td className="max-w-xs px-4 py-3 text-slate-500">
                              {band.description || '—'}
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditBand(band)}
                                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                                  title="Edit band"
                                >
                                  <Pencil size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void handleDeleteBand(band)}
                                  className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                                  title="Delete band"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}