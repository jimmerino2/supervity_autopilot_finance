'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Icons } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

export interface BankAccountHistoryEntry {
  bank_key: string
  valid_to?: string
  vendor_id?: number
  changed_by?: string
  is_current?: boolean
  valid_from?: string
  sequence_no?: number
  bank_country?: string
  change_source?: string
  account_number?: string
}

export interface VendorRecord {
  vendor_id: number
  vendor_name: string
  tax_id: string
  bank_country: string
  bank_key: string
  bank_account_number: string
  currency_code: string
  payment_terms: string
  account_group: string
  is_blocked: boolean
  is_deleted: boolean
  country_code: string
  email: string
  created_at?: string
  last_bank_change_at?: string | null
  bank_account_history?: BankAccountHistoryEntry[]
}

type Column = {
  key: SortKey
  label: string
  numeric?: boolean
}

type SortKey = keyof VendorRecord

type SortDirection = 'asc' | 'desc'

interface VendorsTableProps {
  rows: VendorRecord[]
  onView?: (row: VendorRecord) => void
  onEdit?: (row: VendorRecord) => void
  onDelete?: (row: VendorRecord) => void
}

const columns: Column[] = [
  { key: 'vendor_name', label: 'Vendor' },
  { key: 'email', label: 'Email' },
  { key: 'country_code', label: 'Country' },
  { key: 'bank_country', label: 'Bank Country' },
  { key: 'currency_code', label: 'Currency' },
  { key: 'payment_terms', label: 'Payment Terms' },
]

export function VendorsTable({ rows, onView, onEdit, onDelete }: VendorsTableProps) {
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('vendor_name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const filteredRows = useMemo(() => {
    const normalized = filter.trim().toLowerCase()
    const filtered = normalized
      ? rows.filter((row) =>
          [
            row.vendor_name,
            row.email,
            row.country_code,
            row.bank_country,
            row.currency_code,
            row.payment_terms,
          ]
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
            placeholder='Search vendors by name, email, or country'
            className='min-w-0'
          />
        </div>

        <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
          <Button variant='outline' size='sm' onClick={() => setFilter('')} disabled={!filter}>
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
              {(onView || onEdit || onDelete) && (
                <th className='px-4 py-3 text-left font-semibold text-slate-700'>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + ((onView || onEdit || onDelete) ? 1 : 0)} className='px-4 py-6 text-center text-sm text-muted-foreground'>
                  No matching vendors found.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.vendor_id} className='border-t border-border last:border-b'>
                  <td className='whitespace-nowrap px-4 py-4'>{row.vendor_name}</td>
                  <td className='whitespace-nowrap px-4 py-4'>{row.email}</td>
                  <td className='whitespace-nowrap px-4 py-4'>{row.country_code}</td>
                  <td className='whitespace-nowrap px-4 py-4'>{row.bank_country}</td>
                  <td className='whitespace-nowrap px-4 py-4'>{row.currency_code}</td>
                  <td className='whitespace-nowrap px-4 py-4'>{row.payment_terms}</td>
                  {(onView || onEdit || onDelete) && (
                    <td className='whitespace-nowrap px-4 py-4'>
                      <div className='flex items-center gap-2'>
                        {onView && (
                          <Button variant='outline' size='sm' className='gap-1' onClick={() => onView(row)}>
                            <Icons.eye className='h-4 w-4' />
                            View
                          </Button>
                        )}
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
