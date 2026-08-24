import type { MicrochipInventoryRow } from './microchip-inventory'

const statusLabels: Record<MicrochipInventoryRow['status'], string> = {
  available: 'Disponible',
  implanted: 'Implantado',
  blocked: 'Bloqueado',
}

const statusClasses: Record<MicrochipInventoryRow['status'], string> = {
  available: 'bg-emerald-100 text-emerald-800',
  implanted: 'bg-sky-100 text-sky-800',
  blocked: 'bg-stone-200 text-stone-800',
}

export function MicrochipStatusBadge({ status }: Pick<MicrochipInventoryRow, 'status'>) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  )
}
