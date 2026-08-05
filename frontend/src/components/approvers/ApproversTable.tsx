'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Icons } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

export interface ApproverRecord {
  approval_matrix_id: number
  role: string
  approver_name: string
  approver_email: string
  min_amount: number
  max_amount: number
  cost_center: string
}

type Column = {
  key: SortKey
  label: string
  numeric?: boolean
}

const columns: Column[] = [
  { key: 'approver_name', label: 'Name' },
  { key: 'approver_email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'min_amount', label: 'Min (RM)', numeric: true },
  { key: 'max_amount', label: 'Max (RM)', numeric: true },
  { key: 'cost_center', label: 'Cost Center' },
]

type SortKey = keyof ApproverRecord

type SortDirection = 'asc' | 'desc'

interface ApproversTableProps {
  rows: ApproverRecord[]
  onEdit?: (row: ApproverRecord) => void
  onDelete?: (row: ApproverRecord) => void
}

function formatCurrency(value: number) {
  return `RM ${value.toLocaleString('en-MY', { maximumFractionDigits: 0 })}`
}

export function ApproversTable({ rows, onEdit, onDelete }: ApproversTableProps) {
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('approver_name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const filteredRows = useMemo(() => {
    const normalized = filter.trim().toLowerCase()
    const filtered = normalized
      ? rows.filter((row) =>
          [row.approver_name, row.approver_email, row.role, row.cost_center]
            .join(' ')
            .toLowerCase()
            .includes(normalized)
        )
      : rows

    return [...filtered].sort((a, b) => {
      const aValue = a[sortKey]
      const bValue = b[sortKey]

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      return sortDirection === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue))
    })
  }, [filter, rows, sortKey, sortDirection])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-3 rounded-3xl border border-border bg-white/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex-1'>
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder='Search by name, email, role or cost center'
            className='min-w-0'
          />
        </div>

        <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setFilter('')}
            disabled={!filter}
          >
            <Icons.refresh className='mr-2 h-4 w-4' />
            Clear
          </Button>
          <div className='rounded-2xl border border-border bg-muted/80 px-3 py-2 text-sm text-muted-foreground'>
            {filteredRows.length} record{filteredRows.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div className='overflow-hidden rounded-3xl border border-border bg-white shadow-sm'>
        <table className='min-w-full border-collapse text-left text-sm'>
          <thead className='bg-slate-50'>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'cursor-pointer px-4 py-3 font-semibold text-slate-700',
                    column.numeric ? 'text-right' : 'text-left'
                  )}
                  onClick={() => handleSort(column.key)}
                >
                  <div className='flex items-center gap-2'>
                    {column.label}
                    <Icons.chevronUp
                      className={cn(
                        'h-3 w-3 transition-transform duration-200',
                        sortKey === column.key && sortDirection === 'desc'
                          ? 'rotate-180 text-brand-navy'
                          : 'text-muted-foreground'
                      )}
                    />
                  </div>
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className='px-4 py-3 text-left font-semibold text-slate-700'>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className='px-4 py-6 text-center text-sm text-muted-foreground'>
                  No matching approvers found.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.approval_matrix_id} className='border-t border-border last:border-b'>
                  <td className='whitespace-nowrap px-4 py-4'>{row.approver_name}</td>
                  <td className='whitespace-nowrap px-4 py-4'>{row.approver_email}</td>
                  <td className='whitespace-nowrap px-4 py-4'>{row.role}</td>
                  <td className='whitespace-nowrap px-4 py-4 text-right'>{formatCurrency(row.min_amount)}</td>
                  <td className='whitespace-nowrap px-4 py-4 text-right'>{formatCurrency(row.max_amount)}</td>
                  <td className='whitespace-nowrap px-4 py-4'>{row.cost_center}</td>
                  {(onEdit || onDelete) && (
                    <td className='whitespace-nowrap px-4 py-4'>
                      <div className='flex items-center gap-2'>
                        {onEdit && (
                          <Button
                            variant='outline'
                            size='sm'
                            className='gap-1'
                            onClick={() => onEdit(row)}
                          >
                            <Icons.edit className='h-4 w-4' />
                            Edit
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant='destructive'
                            size='sm'
                            className='gap-1'
                            onClick={() => onDelete(row)}
                          >
                            <Icons.trash className='h-4 w-4' />
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
