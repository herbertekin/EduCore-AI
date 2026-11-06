
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import {
  ArrowLeft,
  BookOpen,
  Layers,
  GraduationCap,
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Save,
  X,
  Search,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'

import { supabase } from '../lib/supabase'

type Subject = {
  id: string
  subject_code: string
  subject_name: string
}

type LearningStrand = {
  id: string
  school_id: string
  subject_id: string
  strand_name: string
  description: string | null
  grade_level: string | null
  curriculum: string | null
}

type LearningSubStrand = {
  id: string
  school_id: string
  strand_id: string
  sub_strand_name: string
  description: string | null
}

type Competency = {
  id: string
  school_id: string
  subject_id: string
  sub_strand_id: string
  competency_name: string
  description: string | null
  grade_level: string | null
  learning_outcome: string | null
}

type PerformanceLevel = 'EE' | 'ME' | 'AE' | 'BE'

type CompetencyRubric = {
  id: string
  competency_id: string
  performance_level: PerformanceLevel
  rubric_description: string
}

type Props = {
  schoolId: string
  schoolName: string
  onBack: () => void
}

type Tab = 'strands' | 'sub-strands' | 'competencies' | 'rubrics'

const PERFORMANCE_LEVELS: {
  value: PerformanceLevel
  label: string
  description: string
}[] = [
  {
    value: 'EE',
    label: 'Exceeding Expectations',
    description: 'Demonstrates performance beyond the expected standard.',
  },
  {
    value: 'ME',
    label: 'Meeting Expectations',
    description: 'Demonstrates the expected level of performance.',
  },
  {
    value: 'AE',
    label: 'Approaching Expectations',
    description: 'Is developing towards the expected level of performance.',
  },
  {
    value: 'BE',
    label: 'Below Expectations',
    description: 'Requires additional support to achieve the expected standard.',
  },
]

const EMPTY_STRAND = {
  subject_id: '',
  strand_name: '',
  description: '',
  grade_level: '',
  curriculum: 'CBC',
}

const EMPTY_SUB_STRAND = {
  strand_id: '',
  sub_strand_name: '',
  description: '',
}

const EMPTY_COMPETENCY = {
  sub_strand_id: '',
  competency_name: '',
  description: '',
  grade_level: '',
  learning_outcome: '',
}

const EMPTY_RUBRIC = {
  competency_id: '',
  performance_level: 'EE' as PerformanceLevel,
  rubric_description: '',
}

export default function CBEManagement({
  schoolId,
  schoolName,
  onBack,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('strands')

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [strands, setStrands] = useState<LearningStrand[]>([])
  const [subStrands, setSubStrands] = useState<LearningSubStrand[]>([])
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [rubrics, setRubrics] = useState<CompetencyRubric[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')

  const [strandForm, setStrandForm] = useState(EMPTY_STRAND)
  const [subStrandForm, setSubStrandForm] = useState(EMPTY_SUB_STRAND)
  const [competencyForm, setCompetencyForm] = useState(EMPTY_COMPETENCY)
  const [rubricForm, setRubricForm] = useState(EMPTY_RUBRIC)

  const [editingStrandId, setEditingStrandId] = useState<string | null>(null)
  const [editingSubStrandId, setEditingSubStrandId] = useState<string | null>(null)
  const [editingCompetencyId, setEditingCompetencyId] = useState<string | null>(null)
  const [editingRubricId, setEditingRubricId] = useState<string | null>(null)

  const [showStrandForm, setShowStrandForm] = useState(false)
  const [showSubStrandForm, setShowSubStrandForm] = useState(false)
  const [showCompetencyForm, setShowCompetencyForm] = useState(false)
  const [showRubricForm, setShowRubricForm] = useState(false)

  const [selectedStrandId, setSelectedStrandId] = useState('')
  const [selectedSubStrandId, setSelectedSubStrandId] = useState('')
  const [selectedCompetencyId, setSelectedCompetencyId] = useState('')

  const [subjectFilter, setSubjectFilter] = useState('')

  // --------------------------------------------------
  // LOAD SCHOOL CURRICULUM DATA
  // --------------------------------------------------

  const loadData = useCallback(async () => {
    if (!schoolId) {
      setError('A valid school must be selected.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [
        subjectsResponse,
        strandsResponse,
        subStrandsResponse,
        competenciesResponse,
      ] = await Promise.all([
        supabase
          .from('subjects')
          .select('id, subject_code, subject_name')
          .eq('school_id', schoolId)
          .order('subject_name'),

        supabase
          .from('learning_strands')
          .select('*')
          .eq('school_id', schoolId)
          .order('strand_name'),

        supabase
          .from('learning_sub_strands')
          .select('*')
          .eq('school_id', schoolId)
          .order('sub_strand_name'),

        supabase
          .from('competencies')
          .select('*')
          .eq('school_id', schoolId)
          .order('competency_name'),
      ])

      if (subjectsResponse.error) throw subjectsResponse.error
      if (strandsResponse.error) throw strandsResponse.error
      if (subStrandsResponse.error) throw subStrandsResponse.error
      if (competenciesResponse.error) throw competenciesResponse.error

      const loadedSubjects = (subjectsResponse.data ?? []) as Subject[]
      const loadedStrands = (strandsResponse.data ?? []) as LearningStrand[]
      const loadedSubStrands = (subStrandsResponse.data ?? []) as LearningSubStrand[]
      const loadedCompetencies = (competenciesResponse.data ?? []) as Competency[]

      setSubjects(loadedSubjects)
      setStrands(loadedStrands)
      setSubStrands(loadedSubStrands)
      setCompetencies(loadedCompetencies)

      if (loadedCompetencies.length === 0) {
        setRubrics([])
      } else {
        const competencyIds = loadedCompetencies.map((item) => item.id)

        const rubricResponse = await supabase
          .from('competency_rubrics')
          .select('*')
          .in('competency_id', competencyIds)
          .order('performance_level')

        if (rubricResponse.error) throw rubricResponse.error

        setRubrics((rubricResponse.data ?? []) as CompetencyRubric[])
      }
    } catch (err) {
      console.error('CBE data loading error:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load CBE curriculum data.',
      )
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // --------------------------------------------------
  // HELPER FUNCTIONS
  // --------------------------------------------------

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const subjectName = (subjectId: string) =>
    subjects.find((item) => item.id === subjectId)?.subject_name ||
    'Unknown subject'

  const strandName = (strandId: string) =>
    strands.find((item) => item.id === strandId)?.strand_name ||
    'Unknown strand'

  const subStrandName = (subStrandId: string) =>
    subStrands.find((item) => item.id === subStrandId)?.sub_strand_name ||
    'Unknown sub-strand'

  const competencyName = (competencyId: string) =>
    competencies.find((item) => item.id === competencyId)?.competency_name ||
    'Unknown competency'

  // --------------------------------------------------
  // FILTERED DATA
  // --------------------------------------------------

  const filteredStrands = useMemo(() => {
    const term = search.trim().toLowerCase()

    return strands.filter((item) => {
      const matchesSearch =
        !term ||
        item.strand_name.toLowerCase().includes(term) ||
        (item.description ?? '').toLowerCase().includes(term)

      const matchesSubject =
        !subjectFilter || item.subject_id === subjectFilter

      return matchesSearch && matchesSubject
    })
  }, [strands, search, subjectFilter])

  const filteredSubStrands = useMemo(() => {
    const term = search.trim().toLowerCase()

    return subStrands.filter((item) => {
      const parent = strands.find(
        (strand) => strand.id === item.strand_id,
      )?.strand_name ?? ''

      return (
        (!selectedStrandId || item.strand_id === selectedStrandId) &&
        (
          !term ||
          item.sub_strand_name.toLowerCase().includes(term) ||
          (item.description ?? '').toLowerCase().includes(term) ||
          parent.toLowerCase().includes(term)
        )
      )
    })
  }, [subStrands, search, strands, selectedStrandId])

  const filteredCompetencies = useMemo(() => {
    const term = search.trim().toLowerCase()

    return competencies.filter((item) => {
      const parent = subStrands.find(
        (subStrand) => subStrand.id === item.sub_strand_id,
      )?.sub_strand_name ?? ''

      return (
        (!selectedSubStrandId || item.sub_strand_id === selectedSubStrandId) &&
        (
          !term ||
          item.competency_name.toLowerCase().includes(term) ||
          (item.description ?? '').toLowerCase().includes(term) ||
          (item.learning_outcome ?? '').toLowerCase().includes(term) ||
          parent.toLowerCase().includes(term)
        )
      )
    })
  }, [competencies, search, subStrands, selectedSubStrandId])

  const filteredRubrics = useMemo(() => {
    const term = search.trim().toLowerCase()

    return rubrics.filter((item) => {
      const parent = competencies.find(
        (competency) => competency.id === item.competency_id,
      )?.competency_name ?? ''

      return (
        (!selectedCompetencyId || item.competency_id === selectedCompetencyId) &&
        (
          !term ||
          item.rubric_description.toLowerCase().includes(term) ||
          parent.toLowerCase().includes(term)
        )
      )
    })
  }, [rubrics, search, selectedCompetencyId, competencies])

  // --------------------------------------------------
  // LEARNING STRAND CRUD
  // --------------------------------------------------

  const handleStrandSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearMessages()

    if (!strandForm.subject_id || !strandForm.strand_name.trim()) {
      setError('Select a subject and enter a strand name.')
      return
    }

    setSaving(true)

    const payload = {
      school_id: schoolId,
      subject_id: strandForm.subject_id,
      strand_name: strandForm.strand_name.trim(),
      description: strandForm.description.trim() || null,
      grade_level: strandForm.grade_level.trim() || null,
      curriculum: strandForm.curriculum.trim() || 'CBC',
    }

    try {
      const response = editingStrandId
        ? await supabase
            .from('learning_strands')
            .update(payload)
            .eq('id', editingStrandId)
            .eq('school_id', schoolId)
        : await supabase
            .from('learning_strands')
            .insert(payload)

      if (response.error) throw response.error

      setSuccess(
        editingStrandId
          ? 'Learning strand updated.'
          : 'Learning strand created.',
      )

      setStrandForm(EMPTY_STRAND)
      setEditingStrandId(null)
      setShowStrandForm(false)

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save learning strand.',
      )
    } finally {
      setSaving(false)
    }
  }

  const editStrand = (item: LearningStrand) => {
    clearMessages()

    setEditingStrandId(item.id)

    setStrandForm({
      subject_id: item.subject_id,
      strand_name: item.strand_name,
      description: item.description || '',
      grade_level: item.grade_level || '',
      curriculum: item.curriculum || 'CBC',
    })

    setShowStrandForm(true)
  }

  const deleteStrand = async (item: LearningStrand) => {
    if (
      !window.confirm(
        `Delete the strand "${item.strand_name}"? Child records may prevent deletion.`,
      )
    ) return

    clearMessages()
    setSaving(true)

    try {
      const { error: deleteError } = await supabase
        .from('learning_strands')
        .delete()
        .eq('id', item.id)
        .eq('school_id', schoolId)

      if (deleteError) throw deleteError

      setSuccess('Learning strand deleted.')
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete learning strand.',
      )
    } finally {
      setSaving(false)
    }
  }

  // --------------------------------------------------
  // LEARNING SUB-STRAND CRUD
  // --------------------------------------------------

  const handleSubStrandSave = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    clearMessages()

    if (
      !subStrandForm.strand_id ||
      !subStrandForm.sub_strand_name.trim()
    ) {
      setError('Select a parent strand and enter a sub-strand name.')
      return
    }

    const parent = strands.find(
      (item) => item.id === subStrandForm.strand_id,
    )

    if (!parent || parent.school_id !== schoolId) {
      setError('The selected learning strand is invalid.')
      return
    }

    setSaving(true)

    const payload = {
      school_id: schoolId,
      strand_id: subStrandForm.strand_id,
      sub_strand_name: subStrandForm.sub_strand_name.trim(),
      description: subStrandForm.description.trim() || null,
    }

    try {
      const response = editingSubStrandId
        ? await supabase
            .from('learning_sub_strands')
            .update(payload)
            .eq('id', editingSubStrandId)
            .eq('school_id', schoolId)
        : await supabase
            .from('learning_sub_strands')
            .insert(payload)

      if (response.error) throw response.error

      setSuccess(
        editingSubStrandId
          ? 'Sub-strand updated.'
          : 'Sub-strand created.',
      )

      setSubStrandForm(EMPTY_SUB_STRAND)
      setEditingSubStrandId(null)
      setShowSubStrandForm(false)

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save sub-strand.',
      )
    } finally {
      setSaving(false)
    }
  }

  const editSubStrand = (item: LearningSubStrand) => {
    clearMessages()

    setEditingSubStrandId(item.id)

    setSubStrandForm({
      strand_id: item.strand_id,
      sub_strand_name: item.sub_strand_name,
      description: item.description || '',
    })

    setShowSubStrandForm(true)
  }

  const deleteSubStrand = async (item: LearningSubStrand) => {
    if (
      !window.confirm(
        `Delete the sub-strand "${item.sub_strand_name}"?`,
      )
    ) return

    clearMessages()
    setSaving(true)

    try {
      const { error: deleteError } = await supabase
        .from('learning_sub_strands')
        .delete()
        .eq('id', item.id)
        .eq('school_id', schoolId)

      if (deleteError) throw deleteError

      setSuccess('Sub-strand deleted.')
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete sub-strand.',
      )
    } finally {
      setSaving(false)
    }
  }

  // --------------------------------------------------
  // COMPETENCY CRUD
  // --------------------------------------------------

  const handleCompetencySave = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    clearMessages()

    if (
      !competencyForm.sub_strand_id ||
      !competencyForm.competency_name.trim()
    ) {
      setError('Select a sub-strand and enter a competency name.')
      return
    }

    const parent = subStrands.find(
      (item) => item.id === competencyForm.sub_strand_id,
    )

    const parentStrand = parent
      ? strands.find((item) => item.id === parent.strand_id)
      : undefined

    if (
      !parent ||
      !parentStrand ||
      parent.school_id !== schoolId ||
      parentStrand.school_id !== schoolId
    ) {
      setError('The selected sub-strand is invalid.')
      return
    }

    setSaving(true)

    const payload = {
      school_id: schoolId,
      subject_id: parentStrand.subject_id,
      sub_strand_id: competencyForm.sub_strand_id,
      competency_name: competencyForm.competency_name.trim(),
      description: competencyForm.description.trim() || null,
      grade_level: competencyForm.grade_level.trim() || null,
      learning_outcome: competencyForm.learning_outcome.trim() || null,
    }

    try {
      const response = editingCompetencyId
        ? await supabase
            .from('competencies')
            .update(payload)
            .eq('id', editingCompetencyId)
            .eq('school_id', schoolId)
        : await supabase
            .from('competencies')
            .insert(payload)

      if (response.error) throw response.error

      setSuccess(
        editingCompetencyId
          ? 'Competency updated.'
          : 'Competency created.',
      )

      setCompetencyForm(EMPTY_COMPETENCY)
      setEditingCompetencyId(null)
      setShowCompetencyForm(false)

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save competency.',
      )
    } finally {
      setSaving(false)
    }
  }

  const editCompetency = (item: Competency) => {
    clearMessages()

    setEditingCompetencyId(item.id)

    setCompetencyForm({
      sub_strand_id: item.sub_strand_id,
      competency_name: item.competency_name,
      description: item.description || '',
      grade_level: item.grade_level || '',
      learning_outcome: item.learning_outcome || '',
    })

    setShowCompetencyForm(true)
  }

  const deleteCompetency = async (item: Competency) => {
    if (
      !window.confirm(
        `Delete the competency "${item.competency_name}"?`,
      )
    ) return

    clearMessages()
    setSaving(true)

    try {
      const { error: deleteError } = await supabase
        .from('competencies')
        .delete()
        .eq('id', item.id)
        .eq('school_id', schoolId)

      if (deleteError) throw deleteError

      setSuccess('Competency deleted.')
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete competency.',
      )
    } finally {
      setSaving(false)
    }
  }

  // --------------------------------------------------
  // COMPETENCY RUBRIC CRUD
  // --------------------------------------------------

  const handleRubricSave = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    clearMessages()

    if (
      !rubricForm.competency_id ||
      !rubricForm.rubric_description.trim()
    ) {
      setError('Select a competency and enter the rubric descriptor.')
      return
    }

    const selectedCompetency = competencies.find(
      (item) => item.id === rubricForm.competency_id,
    )

    if (
      !selectedCompetency ||
      selectedCompetency.school_id !== schoolId
    ) {
      setError('The selected competency is invalid.')
      return
    }

    const payload = {
      competency_id: rubricForm.competency_id,
      performance_level: rubricForm.performance_level,
      rubric_description: rubricForm.rubric_description.trim(),
    }

    setSaving(true)

    try {
      // Check for an existing level on this competency.
      // This also gives a clearer message than a raw unique-constraint error.
      const duplicateQuery = await supabase
        .from('competency_rubrics')
        .select('id')
        .eq('competency_id', rubricForm.competency_id)
        .eq('performance_level', rubricForm.performance_level)
        .limit(1)

      if (duplicateQuery.error) throw duplicateQuery.error

      const duplicate = duplicateQuery.data?.find(
        (item) => item.id !== editingRubricId,
      )

      if (duplicate) {
        throw new Error(
          `A ${rubricForm.performance_level} rubric already exists for this competency. Edit the existing descriptor instead.`,
        )
      }

      const response = editingRubricId
        ? await supabase
            .from('competency_rubrics')
            .update(payload)
            .eq('id', editingRubricId)
            .eq('competency_id', selectedCompetency.id)
        : await supabase
            .from('competency_rubrics')
            .insert(payload)

      if (response.error) throw response.error

      setSuccess(
        editingRubricId
          ? 'Rubric descriptor updated.'
          : 'Rubric descriptor created.',
      )

      setRubricForm(EMPTY_RUBRIC)
      setEditingRubricId(null)
      setShowRubricForm(false)

      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save rubric descriptor.',
      )
    } finally {
      setSaving(false)
    }
  }

  const editRubric = (item: CompetencyRubric) => {
    clearMessages()

    setEditingRubricId(item.id)

    setRubricForm({
      competency_id: item.competency_id,
      performance_level: item.performance_level,
      rubric_description: item.rubric_description,
    })

    setShowRubricForm(true)
  }

  const deleteRubric = async (item: CompetencyRubric) => {
    if (!window.confirm('Delete this rubric descriptor?')) return

    clearMessages()
    setSaving(true)

    try {
      const { error: deleteError } = await supabase
        .from('competency_rubrics')
        .delete()
        .eq('id', item.id)
        .eq('competency_id', item.competency_id)

      if (deleteError) throw deleteError

      setSuccess('Rubric descriptor deleted.')
      await loadData()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete rubric descriptor.',
      )
    } finally {
      setSaving(false)
    }
  }

  // --------------------------------------------------
  // FORM RESET
  // --------------------------------------------------

  const cancelForms = () => {
    setShowStrandForm(false)
    setShowSubStrandForm(false)
    setShowCompetencyForm(false)
    setShowRubricForm(false)

    setEditingStrandId(null)
    setEditingSubStrandId(null)
    setEditingCompetencyId(null)
    setEditingRubricId(null)

    setStrandForm(EMPTY_STRAND)
    setSubStrandForm(EMPTY_SUB_STRAND)
    setCompetencyForm(EMPTY_COMPETENCY)
    setRubricForm(EMPTY_RUBRIC)

    clearMessages()
  }

  // --------------------------------------------------
  // UI HELPERS
  // --------------------------------------------------

  const tabs: {
    id: Tab
    label: string
    icon: typeof BookOpen
    count: number
  }[] = [
    {
      id: 'strands',
      label: 'Learning Strands',
      icon: BookOpen,
      count: strands.length,
    },
    {
      id: 'sub-strands',
      label: 'Sub-Strands',
      icon: Layers,
      count: subStrands.length,
    },
    {
      id: 'competencies',
      label: 'Competencies',
      icon: GraduationCap,
      count: competencies.length,
    },
    {
      id: 'rubrics',
      label: 'Assessment Rubrics',
      icon: ClipboardList,
      count: rubrics.length,
    },
  ]

  const tabClass = (tab: Tab) =>
    `flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-3 text-sm font-medium transition ${
      activeTab === tab
        ? 'bg-emerald-700 text-white shadow-sm'
        : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-800'
    }`

  const inputClass =
    'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'

  const labelClass = 'block text-sm font-medium text-gray-700'

  const renderActions = (
    onEdit: () => void,
    onDelete: () => void,
  ) => (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onEdit}
        disabled={saving}
        title="Edit"
        className="rounded-lg p-2 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
      >
        <Pencil size={16} />
      </button>

      <button
        type="button"
        onClick={onDelete}
        disabled={saving}
        title="Delete"
        className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )

  // --------------------------------------------------
  // STRAND FORM
  // --------------------------------------------------

  const renderStrandForm = () => (
    <form
      onSubmit={handleStrandSave}
      className="space-y-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          {editingStrandId ? 'Edit Learning Strand' : 'Create Learning Strand'}
        </h3>

        <button
          type="button"
          onClick={cancelForms}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Learning Area / Subject *
          <select
            required
            className={inputClass}
            value={strandForm.subject_id}
            onChange={(e) =>
              setStrandForm({
                ...strandForm,
                subject_id: e.target.value,
              })
            }
          >
            <option value="">Select subject</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.subject_code} — {subject.subject_name}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Strand Name *
          <input
            required
            className={inputClass}
            value={strandForm.strand_name}
            onChange={(e) =>
              setStrandForm({
                ...strandForm,
                strand_name: e.target.value,
              })
            }
            placeholder="e.g. Numbers"
          />
        </label>

        <label className={labelClass}>
          Grade Level
          <input
            className={inputClass}
            value={strandForm.grade_level}
            onChange={(e) =>
              setStrandForm({
                ...strandForm,
                grade_level: e.target.value,
              })
            }
            placeholder="e.g. Grade 4"
          />
        </label>

        <label className={labelClass}>
          Curriculum
          <input
            className={inputClass}
            value={strandForm.curriculum}
            onChange={(e) =>
              setStrandForm({
                ...strandForm,
                curriculum: e.target.value,
              })
            }
            placeholder="CBC"
          />
        </label>
      </div>

      <label className={labelClass}>
        Description
        <textarea
          rows={3}
          className={inputClass}
          value={strandForm.description}
          onChange={(e) =>
            setStrandForm({
              ...strandForm,
              description: e.target.value,
            })
          }
          placeholder="Describe what this learning strand covers..."
        />
      </label>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={cancelForms}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>

        <button
          disabled={saving}
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          <Save size={16} />
          {saving
            ? 'Saving...'
            : editingStrandId
              ? 'Update Strand'
              : 'Save Strand'}
        </button>
      </div>
    </form>
  )

  // --------------------------------------------------
  // SUB-STRAND FORM
  // --------------------------------------------------

  const renderSubStrandForm = () => (
    <form
      onSubmit={handleSubStrandSave}
      className="space-y-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          {editingSubStrandId ? 'Edit Sub-Strand' : 'Create Sub-Strand'}
        </h3>

        <button
          type="button"
          onClick={cancelForms}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        >
          <X size={18} />
        </button>
      </div>

      <label className={labelClass}>
        Parent Learning Strand *
        <select
          required
          className={inputClass}
          value={subStrandForm.strand_id}
          onChange={(e) =>
            setSubStrandForm({
              ...subStrandForm,
              strand_id: e.target.value,
            })
          }
        >
          <option value="">Select learning strand</option>

          {strands.map((item) => (
            <option key={item.id} value={item.id}>
              {subjectName(item.subject_id)} — {item.strand_name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        Sub-Strand Name *
        <input
          required
          className={inputClass}
          value={subStrandForm.sub_strand_name}
          onChange={(e) =>
            setSubStrandForm({
              ...subStrandForm,
              sub_strand_name: e.target.value,
            })
          }
          placeholder="e.g. Whole Numbers"
        />
      </label>

      <label className={labelClass}>
        Description
        <textarea
          rows={3}
          className={inputClass}
          value={subStrandForm.description}
          onChange={(e) =>
            setSubStrandForm({
              ...subStrandForm,
              description: e.target.value,
            })
          }
          placeholder="Describe the sub-strand..."
        />
      </label>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={cancelForms}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>

        <button
          disabled={saving}
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          <Save size={16} />
          {saving
            ? 'Saving...'
            : editingSubStrandId
              ? 'Update Sub-Strand'
              : 'Save Sub-Strand'}
        </button>
      </div>
    </form>
  )

  // --------------------------------------------------
  // COMPETENCY FORM
  // --------------------------------------------------

  const renderCompetencyForm = () => (
    <form
      onSubmit={handleCompetencySave}
      className="space-y-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          {editingCompetencyId ? 'Edit Competency' : 'Create Competency'}
        </h3>

        <button
          type="button"
          onClick={cancelForms}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        >
          <X size={18} />
        </button>
      </div>

      <label className={labelClass}>
        Parent Sub-Strand *
        <select
          required
          className={inputClass}
          value={competencyForm.sub_strand_id}
          onChange={(e) =>
            setCompetencyForm({
              ...competencyForm,
              sub_strand_id: e.target.value,
            })
          }
        >
          <option value="">Select sub-strand</option>

          {subStrands.map((item) => (
            <option key={item.id} value={item.id}>
              {strandName(item.strand_id)} — {item.sub_strand_name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        Competency Name *
        <input
          required
          className={inputClass}
          value={competencyForm.competency_name}
          onChange={(e) =>
            setCompetencyForm({
              ...competencyForm,
              competency_name: e.target.value,
            })
          }
          placeholder="e.g. Solves mathematical problems"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Grade Level
          <input
            className={inputClass}
            value={competencyForm.grade_level}
            onChange={(e) =>
              setCompetencyForm({
                ...competencyForm,
                grade_level: e.target.value,
              })
            }
            placeholder="e.g. Grade 4"
          />
        </label>

        <label className={labelClass}>
          Learning Outcome
          <input
            className={inputClass}
            value={competencyForm.learning_outcome}
            onChange={(e) =>
              setCompetencyForm({
                ...competencyForm,
                learning_outcome: e.target.value,
              })
            }
            placeholder="Expected learner achievement"
          />
        </label>
      </div>

      <label className={labelClass}>
        Competency Description
        <textarea
          rows={3}
          className={inputClass}
          value={competencyForm.description}
          onChange={(e) =>
            setCompetencyForm({
              ...competencyForm,
              description: e.target.value,
            })
          }
          placeholder="Describe the skill or ability being developed..."
        />
      </label>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={cancelForms}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>

        <button
          disabled={saving}
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          <Save size={16} />
          {saving
            ? 'Saving...'
            : editingCompetencyId
              ? 'Update Competency'
              : 'Save Competency'}
        </button>
      </div>
    </form>
  )

  // --------------------------------------------------
  // RUBRIC FORM
  // --------------------------------------------------

  const renderRubricForm = () => (
    <form
      onSubmit={handleRubricSave}
      className="space-y-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          {editingRubricId
            ? 'Edit Rubric Descriptor'
            : 'Create Rubric Descriptor'}
        </h3>

        <button
          type="button"
          onClick={cancelForms}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        >
          <X size={18} />
        </button>
      </div>

      <label className={labelClass}>
        Competency *
        <select
          required
          className={inputClass}
          value={rubricForm.competency_id}
          onChange={(e) =>
            setRubricForm({
              ...rubricForm,
              competency_id: e.target.value,
            })
          }
        >
          <option value="">Select competency</option>

          {competencies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.competency_name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        Performance Level *
        <select
          required
          className={inputClass}
          value={rubricForm.performance_level}
          onChange={(e) =>
            setRubricForm({
              ...rubricForm,
              performance_level: e.target.value as PerformanceLevel,
            })
          }
        >
          {PERFORMANCE_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.value} — {level.label}
            </option>
          ))}
        </select>
      </label>

      <p className="text-xs text-gray-500">
        {
          PERFORMANCE_LEVELS.find(
            (item) => item.value === rubricForm.performance_level,
          )?.description
        }
      </p>

      <label className={labelClass}>
        Performance Descriptor *
        <textarea
          required
          rows={4}
          className={inputClass}
          value={rubricForm.rubric_description}
          onChange={(e) =>
            setRubricForm({
              ...rubricForm,
              rubric_description: e.target.value,
            })
          }
          placeholder="Describe what a learner demonstrates at this performance level..."
        />
      </label>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={cancelForms}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>

        <button
          disabled={saving}
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          <Save size={16} />
          {saving
            ? 'Saving...'
            : editingRubricId
              ? 'Update Descriptor'
              : 'Save Descriptor'}
        </button>
      </div>
    </form>
  )

  // --------------------------------------------------
  // LEARNING STRANDS TAB
  // --------------------------------------------------

  const renderStrands = () => (
    <div className="space-y-5">
      {showStrandForm && renderStrandForm()}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">
            Learning Strands
          </h3>
          <p className="text-sm text-gray-500">
            Organise curriculum content by learning area and grade.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            cancelForms()
            setShowStrandForm(true)
            setStrandForm(EMPTY_STRAND)
          }}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          <Plus size={17} /> Add Strand
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute left-3 top-3 text-gray-400"
          />

          <input
            className={`${inputClass} mt-0 pl-9`}
            placeholder="Search strands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className={`${inputClass} mt-0 sm:max-w-xs`}
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          <option value="">All learning areas</option>

          {subjects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.subject_name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Strand</th>
                <th className="px-4 py-3">Learning Area</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Sub-Strands</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredStrands.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {item.strand_name}
                    </p>
                    <p className="mt-1 max-w-xs truncate text-xs text-gray-500">
                      {item.description || 'No description'}
                    </p>
                  </td>

                  <td className="px-4 py-3 text-gray-600">
                    {subjectName(item.subject_id)}
                  </td>

                  <td className="px-4 py-3 text-gray-600">
                    {item.grade_level || '—'}
                  </td>

                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStrandId(item.id)
                        setActiveTab('sub-strands')
                        setSearch('')
                      }}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      {
                        subStrands.filter(
                          (sub) => sub.strand_id === item.id,
                        ).length
                      } sub-strands
                    </button>
                  </td>

                  <td className="px-4 py-3">
                    {renderActions(
                      () => editStrand(item),
                      () => void deleteStrand(item),
                    )}
                  </td>
                </tr>
              ))}

              {filteredStrands.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-gray-500"
                  >
                    No learning strands found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  // --------------------------------------------------
  // SUB-STRANDS TAB
  // --------------------------------------------------

  const renderSubStrands = () => (
    <div className="space-y-5">
      {showSubStrandForm && renderSubStrandForm()}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">
            Learning Sub-Strands
          </h3>
          <p className="text-sm text-gray-500">
            Break each learning strand into smaller curriculum areas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            cancelForms()
            setShowSubStrandForm(true)
            setSubStrandForm({
              ...EMPTY_SUB_STRAND,
              strand_id: selectedStrandId,
            })
          }}
          disabled={strands.length === 0}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          <Plus size={17} /> Add Sub-Strand
        </button>
      </div>

      <div className="relative">
        <Search
          size={17}
          className="absolute left-3 top-3 text-gray-400"
        />

        <input
          className={`${inputClass} mt-0 pl-9`}
          placeholder="Search sub-strands..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {selectedStrandId && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-sm">
          <span className="text-emerald-900">
            Filtered parent: <strong>{strandName(selectedStrandId)}</strong>
          </span>

          <button
            type="button"
            onClick={() => setSelectedStrandId('')}
            className="text-emerald-800 hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Sub-Strand</th>
                <th className="px-4 py-3">Parent Strand</th>
                <th className="px-4 py-3">Competencies</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredSubStrands.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {item.sub_strand_name}
                    </p>
                    <p className="mt-1 max-w-xs truncate text-xs text-gray-500">
                      {item.description || 'No description'}
                    </p>
                  </td>

                  <td className="px-4 py-3 text-gray-600">
                    {strandName(item.strand_id)}
                  </td>

                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubStrandId(item.id)
                        setActiveTab('competencies')
                        setSearch('')
                      }}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      {
                        competencies.filter(
                          (competency) =>
                            competency.sub_strand_id === item.id,
                        ).length
                      } competencies
                    </button>
                  </td>

                  <td className="px-4 py-3">
                    {renderActions(
                      () => editSubStrand(item),
                      () => void deleteSubStrand(item),
                    )}
                  </td>
                </tr>
              ))}

              {filteredSubStrands.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-gray-500"
                  >
                    No sub-strands found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  // --------------------------------------------------
  // COMPETENCIES TAB
  // --------------------------------------------------

  const renderCompetencies = () => (
    <div className="space-y-5">
      {showCompetencyForm && renderCompetencyForm()}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Competencies</h3>
          <p className="text-sm text-gray-500">
            Define skills, descriptions and expected learning outcomes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            cancelForms()
            setShowCompetencyForm(true)
            setCompetencyForm({
              ...EMPTY_COMPETENCY,
              sub_strand_id: selectedSubStrandId,
            })
          }}
          disabled={subStrands.length === 0}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          <Plus size={17} /> Add Competency
        </button>
      </div>

      <div className="relative">
        <Search
          size={17}
          className="absolute left-3 top-3 text-gray-400"
        />

        <input
          className={`${inputClass} mt-0 pl-9`}
          placeholder="Search competencies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {selectedSubStrandId && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-sm">
          <span className="text-emerald-900">
            Filtered parent: <strong>{subStrandName(selectedSubStrandId)}</strong>
          </span>

          <button
            type="button"
            onClick={() => setSelectedSubStrandId('')}
            className="text-emerald-800 hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      <div className="space-y-3">
        {filteredCompetencies.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-gray-200 bg-white p-4 hover:border-emerald-200"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-gray-900">
                  {item.competency_name}
                </h4>

                <p className="mt-1 text-xs text-gray-500">
                  {subjectName(item.subject_id)}{' '}
                  <ChevronRight className="inline" size={12} />{' '}
                  {subStrandName(item.sub_strand_id)}
                  {item.grade_level ? ` · ${item.grade_level}` : ''}
                </p>

                {item.description && (
                  <p className="mt-3 text-sm text-gray-600">
                    {item.description}
                  </p>
                )}

                {item.learning_outcome && (
                  <p className="mt-2 text-sm text-gray-700">
                    <strong>Learning outcome:</strong>{' '}
                    {item.learning_outcome}
                  </p>
                )}

                <p className="mt-3 text-xs text-emerald-700">
                  {
                    rubrics.filter(
                      (rubric) => rubric.competency_id === item.id,
                    ).length
                  } rubric levels configured
                </p>
              </div>

              {renderActions(
                () => editCompetency(item),
                () => void deleteCompetency(item),
              )}
            </div>
          </div>
        ))}

        {filteredCompetencies.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">
            No competencies found.
          </div>
        )}
      </div>
    </div>
  )

  // --------------------------------------------------
  // ASSESSMENT RUBRICS TAB
  // --------------------------------------------------

  const renderRubrics = () => (
    <div className="space-y-5">
      {showRubricForm && renderRubricForm()}

      <div>
        <h3 className="font-semibold text-gray-900">
          Assessment Rubrics
        </h3>
        <p className="text-sm text-gray-500">
          Define the performance descriptor for each competency and CBE level.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute left-3 top-3 text-gray-400"
          />

          <input
            className={`${inputClass} mt-0 pl-9`}
            placeholder="Search rubric descriptors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className={`${inputClass} mt-0 sm:max-w-xs`}
          value={selectedCompetencyId}
          onChange={(e) => setSelectedCompetencyId(e.target.value)}
        >
          <option value="">All competencies</option>

          {competencies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.competency_name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PERFORMANCE_LEVELS.map((level) => (
          <div
            key={level.value}
            className="rounded-xl border border-gray-200 bg-gray-50 p-4"
          >
            <span className="inline-flex rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
              {level.value}
            </span>

            <h4 className="mt-2 text-sm font-semibold text-gray-900">
              {level.label}
            </h4>

            <p className="mt-1 text-xs text-gray-500">
              {level.description}
            </p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            cancelForms()
            setShowRubricForm(true)
            setRubricForm({
              ...EMPTY_RUBRIC,
              competency_id: selectedCompetencyId,
            })
          }}
          disabled={competencies.length === 0}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          <Plus size={17} /> Add Rubric Descriptor
        </button>
      </div>

      <div className="space-y-3">
        {filteredRubrics.map((item) => {
          const level = PERFORMANCE_LEVELS.find(
            (entry) => entry.value === item.performance_level,
          )

          return (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">
                    {item.performance_level}
                  </span>

                  <span className="text-sm font-semibold text-gray-900">
                    {level?.label || item.performance_level}
                  </span>
                </div>

                <p className="mt-2 text-sm font-medium text-gray-700">
                  {competencyName(item.competency_id)}
                </p>

                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {item.rubric_description}
                </p>
              </div>

              {renderActions(
                () => editRubric(item),
                () => void deleteRubric(item),
              )}
            </div>
          )
        })}

        {filteredRubrics.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">
            No rubric descriptors found.
          </div>
        )}
      </div>
    </div>
  )

  // --------------------------------------------------
  // MAIN PAGE
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onBack}
            className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-700"
          >
            <ArrowLeft size={17} /> Back to Dashboard
          </button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <GraduationCap
                  className="text-emerald-700"
                  size={25}
                />

                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  CBE Management
                </h1>
              </div>

              <p className="mt-1 text-sm text-gray-500">
                {schoolName} · Curriculum and competency configuration
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? 'animate-spin' : ''}
              />
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: 'Learning Strands',
              value: strands.length,
              icon: BookOpen,
            },
            {
              label: 'Sub-Strands',
              value: subStrands.length,
              icon: Layers,
            },
            {
              label: 'Competencies',
              value: competencies.length,
              icon: GraduationCap,
            },
            {
              label: 'Rubric Descriptors',
              value: rubrics.length,
              icon: ClipboardList,
            },
          ].map((stat) => {
            const Icon = stat.icon

            return (
              <div
                key={stat.label}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500 sm:text-sm">
                    {stat.label}
                  </p>

                  <Icon size={18} className="text-emerald-700" />
                </div>

                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {stat.value}
                </p>
              </div>
            )
          })}
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-2">
          <div className="flex min-w-max gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    cancelForms()
                    setActiveTab(tab.id)
                    setSearch('')
                  }}
                  className={tabClass(tab.id)}
                >
                  <Icon size={17} />

                  {tab.label}

                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      activeTab === tab.id
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-sm text-gray-500">
              <RefreshCw size={18} className="animate-spin" />
              Loading curriculum data...
            </div>
          ) : (
            <>
              {activeTab === 'strands' && renderStrands()}
              {activeTab === 'sub-strands' && renderSubStrands()}
              {activeTab === 'competencies' && renderCompetencies()}
              {activeTab === 'rubrics' && renderRubrics()}
            </>
          )}
        </section>

        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <strong>Administrator access:</strong> This module manages
          curriculum structure and rubric descriptors. Teacher assessment
          entry and student competency results will be implemented
          separately with assignment-aware permissions.
        </div>
      </main>
    </div>
  )
}
