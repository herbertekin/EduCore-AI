
import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Trash2,
  RefreshCw,
  Wallet,
  Calculator,
} from 'lucide-react'

import { supabase } from '../lib/supabase'

type FeeStructureManagementProps = {
  schoolId: string
}

type AcademicYear = {
  id: string
  year_name: string
  is_active: boolean
}

type SchoolClass = {
  id: string
  class_name: string
  curriculum: string
}

type Votehead = {
  id: string
  code: string
  name: string
  is_active: boolean
}

type FeeItem = {
  votehead_id: string
  amount: string
}

type FeeStructure = {
  id: string
  structure_name: string
  academic_year_id: string
  class_id: string
  is_active: boolean
  academic_years: { year_name: string } | null
  classes: { class_name: string } | null
}

export default function FeeStructureManagement({
  schoolId,
}: FeeStructureManagementProps) {
  const [years, setYears] = useState<AcademicYear[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [voteheads, setVoteheads] = useState<Votehead[]>([])
  const [structures, setStructures] = useState<FeeStructure[]>([])

  const [academicYearId, setAcademicYearId] = useState('')
  const [classId, setClassId] = useState('')
  const [structureName, setStructureName] = useState('')
  const [items, setItems] = useState<FeeItem[]>([
    { votehead_id: '', amount: '' },
  ])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const totalAmount = useMemo(
    () =>
      items.reduce(
        (total, item) => total + (Number(item.amount) || 0),
        0
      ),
    [items]
  )

  useEffect(() => {
    loadData()
  }, [schoolId])

  async function loadData() {
    setLoading(true)
    setError('')

    const [yearResult, classResult, voteheadResult, structureResult] =
      await Promise.all([
        supabase
          .from('academic_years')
          .select('id, year_name, is_active')
          .eq('school_id', schoolId)
          .order('year_name', { ascending: false }),

        supabase
          .from('classes')
          .select('id, class_name, curriculum')
          .eq('school_id', schoolId)
          .order('class_level'),

        supabase
          .from('fee_voteheads')
          .select('id, code, name, is_active')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('fee_structures')
          .select(`
            id,
            structure_name,
            academic_year_id,
            class_id,
            is_active,
            academic_years(year_name),
            classes(class_name)
          `)
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false }),
      ])

    const firstError =
      yearResult.error ||
      classResult.error ||
      voteheadResult.error ||
      structureResult.error

    if (firstError) {
      setError(firstError.message)
    } else {
      const loadedYears = yearResult.data ?? []

      setYears(loadedYears)
      setClasses(classResult.data ?? [])
      setVoteheads(voteheadResult.data ?? [])
      setStructures((structureResult.data ?? []) as unknown as FeeStructure[])

      const activeYear = loadedYears.find((year) => year.is_active)

      if (activeYear) {
        setAcademicYearId(activeYear.id)
      }
    }

    setLoading(false)
  }

  function updateItem(
    index: number,
    field: keyof FeeItem,
    value: string
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )
    )
  }

  function addItem() {
    setItems((current) => [
      ...current,
      { votehead_id: '', amount: '' },
    ])
  }

  function removeItem(index: number) {
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    )
  }

  async function saveFeeStructure(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (!academicYearId || !classId || !structureName.trim()) {
      setError('Please complete all required fields.')
      return
    }

    if (items.length === 0) {
      setError('Add at least one fee votehead.')
      return
    }

    const invalidItem = items.find(
      (item) =>
        !item.votehead_id ||
        item.amount.trim() === '' ||
        !Number.isFinite(Number(item.amount)) ||
        Number(item.amount) < 0
    )

    if (invalidItem) {
      setError('Select a votehead and enter a valid non-negative amount for every row.')
      return
    }

    const selectedVoteheads = items.map((item) => item.votehead_id)

    if (new Set(selectedVoteheads).size !== selectedVoteheads.length) {
      setError('Each votehead can only appear once in a fee structure.')
      return
    }

    setSaving(true)

    try {
      // Create the parent record first.
      const { data: structure, error: structureError } = await supabase
        .from('fee_structures')
        .insert({
          school_id: schoolId,
          academic_year_id: academicYearId,
          class_id: classId,
          structure_name: structureName.trim(),
        })
        .select('id')
        .single()

      if (structureError) throw structureError

      // Insert all votehead amounts.
      const feeItems = items.map((item) => ({
        school_id: schoolId,
        fee_structure_id: structure.id,
        votehead_id: item.votehead_id,
        amount: Number(item.amount),
      }))

      const { error: itemsError } = await supabase
        .from('fee_structure_items')
        .insert(feeItems)

      if (itemsError) {
        // Avoid leaving a structure without its items.
        const { error: rollbackError } = await supabase
          .from('fee_structures')
          .delete()
          .eq('id', structure.id)
          .eq('school_id', schoolId)

        if (rollbackError) {
          console.error('Could not remove incomplete structure:', rollbackError)
        }

        throw itemsError
      }

      setSuccess('Fee structure saved successfully.')
      setStructureName('')
      setClassId('')
      setItems([{ votehead_id: '', amount: '' }])

      await loadData()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not save fee structure.'

      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const formatKES = (amount: number) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      maximumFractionDigits: 2,
    }).format(amount)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="mr-2 animate-spin" />
        Loading fee structures...
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Fee Structure Management
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Set class fees by academic year and votehead.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Academic years</p>
          <p className="mt-2 text-2xl font-bold">{years.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Classes</p>
          <p className="mt-2 text-2xl font-bold">{classes.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Active voteheads</p>
          <p className="mt-2 text-2xl font-bold">{voteheads.length}</p>
        </div>
      </div>

      <form
        onSubmit={saveFeeStructure}
        className="space-y-6 rounded-xl border bg-white p-6"
      >
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Create Fee Structure
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Configure the fees payable by a particular class.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Academic Year *
            </label>

            <select
              value={academicYearId}
              onChange={(event) => setAcademicYearId(event.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 p-3"
            >
              <option value="">Select academic year</option>
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.year_name} {year.is_active ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Class *
            </label>

            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 p-3"
            >
              <option value="">Select class</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.class_name} ({schoolClass.curriculum})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Fee Structure Name *
          </label>

          <input
            value={structureName}
            onChange={(event) => setStructureName(event.target.value)}
            placeholder="e.g. 2027 Form One Fee Structure"
            required
            className="w-full rounded-lg border border-gray-300 p-3"
          />
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-semibold text-gray-800">
                Fee Voteheads
              </h4>
              <p className="text-sm text-gray-500">
                Enter the amount for each fee category.
              </p>
            </div>

            <button
              type="button"
              onClick={addItem}
              disabled={voteheads.length === 0}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} />
              Add Votehead
            </button>
          </div>

          {voteheads.length === 0 ? (
            <p className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
              No active voteheads found. Create a votehead in Finance first.
            </p>
          ) : (
            items.map((item, index) => (
              <div
                key={index}
                className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]"
              >
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Votehead
                  </label>

                  <select
                    value={item.votehead_id}
                    onChange={(event) =>
                      updateItem(index, 'votehead_id', event.target.value)
                    }
                    required
                    className="w-full rounded-lg border border-gray-300 p-3"
                  >
                    <option value="">Select votehead</option>
                    {voteheads.map((votehead) => (
                      <option key={votehead.id} value={votehead.id}>
                        {votehead.name} ({votehead.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Amount (KES)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.amount}
                    onChange={(event) =>
                      updateItem(index, 'amount', event.target.value)
                    }
                    placeholder="Enter amount"
                    required
                    className="w-full rounded-lg border border-gray-300 p-3"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  title="Remove votehead"
                  className="rounded-lg border border-red-200 p-3 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-emerald-50 p-5">
          <div className="flex items-center gap-3">
            <Calculator className="text-emerald-700" size={24} />
            <div>
              <p className="text-sm text-gray-600">Total fee amount</p>
              <p className="text-xs text-gray-500">
                Sum of all selected voteheads
              </p>
            </div>
          </div>

          <p className="text-2xl font-bold text-emerald-800">
            {formatKES(totalAmount)}
          </p>
        </div>

        <button
          type="submit"
          disabled={saving || voteheads.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Wallet size={18} />
          {saving ? 'Saving...' : 'Save Fee Structure'}
        </button>
      </form>

      <section className="rounded-xl border bg-white p-6">
        <h3 className="mb-5 text-lg font-semibold text-gray-900">
          Existing Fee Structures
        </h3>

        {structures.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">
            No fee structures created yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="p-3">Structure</th>
                  <th className="p-3">Academic Year</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>

              <tbody>
                {structures.map((structure) => (
                  <tr key={structure.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">
                      {structure.structure_name}
                    </td>
                    <td className="p-3">
                      {structure.academic_years?.year_name ?? '—'}
                    </td>
                    <td className="p-3">
                      {structure.classes?.class_name ?? '—'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          structure.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {structure.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
