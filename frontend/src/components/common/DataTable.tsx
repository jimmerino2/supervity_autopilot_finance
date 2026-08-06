'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Icons } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

export interface DataTableColumn<T> {
  key: string
  label: string
  numeric?: boolean
  sortValue?: (row: T) => string | number | null | undefined
  render?: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  rows: T[]
  columns: DataTableColumn<T>[]
  getRowId: (row: T) => string
  searchPlaceholder?: string
  searchableText?: (row: T) => string
  onView?: (row: T) => void
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
  /** When it returns false for a row, the View button is disabled instead of hidden. */
  canView?: (row: T) => boolean
  /** Tooltip shown on the View button when canView(row) is false. */
  viewDisabledTooltip?: string
  emptyMessage?: string
  defaultSortKey?: string
  defaultSortDirection?: 'asc' | 'desc'
}

type SortDirection = 'asc' | 'desc'

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  searchPlaceholder = 'Search records',
  searchableText,
  onView,
  onEdit,
  onDelete,
  canView,
  viewDisabledTooltip,
  emptyMessage = 'No matching records found.',
  defaultSortKey,
  defaultSortDirection = 'asc',
}: DataTableProps<T>) {
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState<string>(defaultSortKey ?? columns[0]?.key ?? '')
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection)

  const activeColumn = columns.find((c) => c.key === sortKey)

  const filteredRows = useMemo(() => {
    const normalized = filter.trim().toLowerCase()
    const filtered =
      normalized && searchableText
        ? rows.filter((row) => searchableText(row).toLowerCase().includes(normalized))
        : rows

    if (!activeColumn) return filtered

    return [...filtered].sort((a, b) => {
      const aValue = activeColumn.sortValue ? activeColumn.sortValue(a) : undefined
      const bValue = activeColumn.sortValue ? activeColumn.sortValue(b) : undefined

      if (aValue == null && bValue == null) return 0
      if (aValue == null) return sortDirection === 'asc' ? -1 : 1
      if (bValue == null) return sortDirection === 'asc' ? 1 : -1

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      return sortDirection === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue))
    })
  }, [filter, rows, activeColumn, sortDirection, searchableText])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  const hasActions = Boolean(onView || onEdit || onDelete)

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-3 rounded-3xl border border-border bg-white/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between'>
        {searchableText ? (
          <div className='flex-1'>
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={searchPlaceholder}
              className='min-w-0'
            />
          </div>
        ) : (
          <div />
        )}

        <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
          {searchableText && (
            <Button variant='outline' size='sm' onClick={() => setFilter('')} disabled={!filter}>
              <Icons.refresh className='mr-2 h-4 w-4' />
              Clear
            </Button>
          )}
          <div className='rounded-2xl border border-border bg-muted/80 px-3 py-2 text-sm text-muted-foreground'>
            {filteredRows.length} record{filteredRows.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div className='overflow-x-auto rounded-3xl border border-border bg-white shadow-sm'>
        <table className='min-w-full border-collapse text-left text-sm'>
          <thead className='bg-slate-50'>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    column.sortValue && 'cursor-pointer',
                    'whitespace-nowrap px-4 py-3 font-semibold text-slate-700',
                    column.numeric ? 'text-right' : 'text-left'
                  )}
                  onClick={() => column.sortValue && handleSort(column.key)}
                >
                  <div className={cn('flex items-center gap-2', column.numeric && 'justify-end')}>
                    {column.label}
                    {column.sortValue && (
                      <Icons.chevronUp
                        className={cn(
                          'h-3 w-3 transition-transform duration-200',
                          sortKey === column.key && sortDirection === 'desc'
                            ? 'rotate-180 text-brand-navy'
                            : 'text-muted-foreground'
                        )}
                      />
                    )}
                  </div>
                </th>
              ))}
              {hasActions && <th className='whitespace-nowrap px-4 py-3 text-left font-semibold text-slate-700'>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (hasActions ? 1 : 0)} className='px-4 py-6 text-center text-sm text-muted-foreground'>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={getRowId(row)} className='border-t border-border last:border-b'>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn('whitespace-nowrap px-4 py-4', column.numeric && 'text-right')}
                    >
                      {column.render ? column.render(row) : '—'}
                    </td>
                  ))}
                  {hasActions && (
                    <td className='whitespace-nowrap px-4 py-4'>
                      <div className='flex items-center gap-2'>
                        {onView &&
                          (() => {
                            const viewable = canView ? canView(row) : true
                            return (
                              <Button
                                variant='outline'
                                size='sm'
                                className='gap-1'
                                onClick={() => viewable && onView(row)}
                                disabled={!viewable}
                                title={!viewable ? viewDisabledTooltip : undefined}
                              >
                                <Icons.eye className='h-4 w-4' />
                                View
                              </Button>
                            )
                          })()}
                        {onEdit && (
                          <Button variant='outline' size='sm' className='gap-1' onClick={() => onEdit(row)}>
                            <Icons.edit className='h-4 w-4' />
                            Edit
                          </Button>
                        )}
                        {onDelete && (
                          <Button variant='destructive' size='sm' className='gap-1' onClick={() => onDelete(row)}>
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
