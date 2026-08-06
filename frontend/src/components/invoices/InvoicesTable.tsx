'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/ui/icons'

export interface InvoiceRecord {
  invoice_doc_no: number
  vendor_invoice_no?: string
  status?: string
  vendor?: {
    vendor_name?: string
  }
  amount?: number
  currency_code?: string
  document_date?: string
  posting_date?: string
}

interface InvoicesTableProps {
  rows: InvoiceRecord[]
  onView: (invoice: InvoiceRecord) => void
  onStatusChange: (invoice: InvoiceRecord, nextStatus: string) => void
  /** The signed-in approver's approval_matrix range. Null while unknown/loading. */
  approverRange: { min: number; max: number } | null
}

/** Some seeded invoice amounts use a comma decimal separator (e.g. '327845,70'). */
export function parseAmount(value: unknown): number | null {
  if (value == null) return null
  const asNumber = Number(value)
  if (!Number.isNaN(asNumber)) return asNumber
  const commaSwapped = Number(String(value).replace(',', '.'))
  return Number.isNaN(commaSwapped) ? null : commaSwapped
}

type SortKey = 'invoice_doc_no' | 'vendor_invoice_no' | 'status' | 'vendor_name' | 'amount'

export function InvoicesTable({ rows, onView, onStatusChange, approverRange }: InvoicesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('invoice_doc_no')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')

  const sortedRows = useMemo(() => {
    const normalized = [...rows]
    normalized.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1

      let valueA: string | number = ''
      let valueB: string | number = ''

      switch (sortKey) {
        case 'invoice_doc_no':
          valueA = a.invoice_doc_no
          valueB = b.invoice_doc_no
          break
        case 'vendor_invoice_no':
          valueA = a.vendor_invoice_no || ''
          valueB = b.vendor_invoice_no || ''
          break
        case 'status':
          valueA = a.status || ''
          valueB = b.status || ''
          break
        case 'vendor_name':
          valueA = a.vendor?.vendor_name || ''
          valueB = b.vendor?.vendor_name || ''
          break
        case 'amount':
          valueA = a.amount || 0
          valueB = b.amount || 0
          break
      }

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return valueA.localeCompare(valueB) * direction
      }

      return (Number(valueA) - Number(valueB)) * direction
    })

    if (!search) return normalized

    return normalized.filter((row) => {
      const haystack = [row.vendor_invoice_no, row.vendor?.vendor_name, row.status, row.invoice_doc_no.toString()]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(search.toLowerCase())
    })
  }, [rows, search, sortDirection, sortKey])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  const getStatusBadgeClass = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'paid':
        return 'bg-emerald-100 text-emerald-700'
      case 'blocked':
        return 'bg-red-100 text-red-700'
      case 'cancelled':
        return 'bg-gray-100 text-gray-700'
      default:
        return 'bg-amber-100 text-amber-700'
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-2'>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder='Search invoices'
          className='w-full max-w-xs rounded-lg border border-input bg-background px-3 py-2 text-sm'
        />
      </div>

      <div className='overflow-x-auto rounded-2xl border border-border/60'>
        <table className='min-w-full divide-y divide-border/70 text-sm'>
          <thead className='bg-slate-50'>
            <tr>
              {[
                ['invoice_doc_no', 'Document No.'],
                ['vendor_invoice_no', 'Invoice No.'],
                ['vendor_name', 'Vendor'],
                ['amount', 'Amount'],
                ['status', 'Status'],
              ].map(([key, label]) => (
                <th key={key} className='cursor-pointer px-4 py-3 text-left font-medium text-slate-600' onClick={() => toggleSort(key as SortKey)}>
                  <div className='flex items-center gap-1'>
                    {label}
                    <Icons.chevronDown className='h-3.5 w-3.5 opacity-60' />
                  </div>
                </th>
              ))}
              <th className='px-4 py-3 text-right font-medium text-slate-600'>Actions</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-border/60 bg-white'>
            {sortedRows.map((row) => {
              const nextStatuses = row.status?.toLowerCase() === 'pending approval'
                ? ['open', 'blocked']
                : row.status?.toLowerCase() === 'open'
                  ? ['paid', 'cancelled']
                  : []

              return (
                <tr key={row.invoice_doc_no} className='hover:bg-slate-50'>
                  <td className='px-4 py-3 font-medium'>{row.invoice_doc_no}</td>
                  <td className='px-4 py-3'>{row.vendor_invoice_no || '—'}</td>
                  <td className='px-4 py-3'>{row.vendor?.vendor_name || '—'}</td>
                  <td className='px-4 py-3'>
                    {row.amount ? `${row.currency_code || 'USD'} ${row.amount.toLocaleString()}` : '—'}
                  </td>
                  <td className='px-4 py-3'>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(row.status)}`}>
                      {row.status?.toUpperCase() || 'Unknown'}
                    </span>
                  </td>
                  <td className='px-4 py-3 text-right'>
                    <div className='flex items-center justify-end gap-2'>
                      <Button variant='ghost' size='sm' onClick={() => onView(row)}>
                        <Icons.eye className='mr-1 h-4 w-4' />
                        View
                      </Button>
                      {nextStatuses.length > 0 && (
                        <div className='flex gap-1'>
                          {nextStatuses.map((status) => {
                            const rowAmount = parseAmount(row.amount)
                            const outOfRange =
                              status === 'paid' &&
                              (!approverRange ||
                                rowAmount == null ||
                                rowAmount < approverRange.min ||
                                rowAmount > approverRange.max)

                            return (
                              <Button
                                key={status}
                                variant='outline'
                                size='sm'
                                disabled={outOfRange}
                                title={
                                  outOfRange
                                    ? approverRange
                                      ? `Outside your approval range (${approverRange.min.toLocaleString()}–${approverRange.max.toLocaleString()})`
                                      : 'Loading your approval range…'
                                    : undefined
                                }
                                onClick={() => onStatusChange(row, status)}
                              >
                                {status === 'paid' ? 'Mark Paid' : status === 'cancelled' ? 'Cancel' : status === 'blocked' ? 'Block' : 'Open'}
                              </Button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
