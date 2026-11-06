import type { LucideIcon } from 'lucide-react'

type StatCardProps = {
  title: string
  value: string | number
  description: string
  icon: LucideIcon
}

export default function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
          <Icon size={20} />
        </div>
      </div>

      <p className="mt-4 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  )
}