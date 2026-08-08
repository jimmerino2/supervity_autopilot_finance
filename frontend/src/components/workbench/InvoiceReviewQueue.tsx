'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api-client'
import { postSSE } from '@/lib/sse-stream'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { Icons } from '@/components/ui/icons'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable, DataTableColumn } from '@/components/common/DataTable'

interface InvoiceRow {
  invoice_doc_no: number
  vendor_invoice_no?: string | null
  status?: string | null
  vendor?: { vendor_name?: string | null } | null
  amount?: number | null
  currency_code?: string | null
}

// Full record returned by GET /api/invoice/{doc_no} — the base invoice plus
// vendor (a real FK, embedded) and best-effort lookups for purchase_order/
// gl_account/company, whose invoice-side columns are raw extracted values
// rather than enforced FKs (see app/routers/invoice.py).
interface InvoiceDetail extends InvoiceRow {
  fiscal_year?: number | null
  document_date?: string | null
  posting_date?: string | null
  tax_code?: string | null
  tax_amount?: number | null
  source_channel?: string | null
  bank_account_on_invoice?: string | null
  gl_account_code?: number | null
  company_code_on_invoice?: string | null
  po_id?: number | null
  po_currency?: string | null
  extraction_confidence?: number | null
  blocked_reason?: string | null
  vendor?: {
    vendor_name?: string | null
    tax_id?: string | null
    bank_country?: string | null
    bank_key?: string | null
    bank_account_number?: string | null
    country_code?: string | null
    email?: string | null
    is_blocked?: boolean | null
  } | null
  purchase_order?: {
    po_id: number
    company_code?: string | null
    process_status?: string | null
    currency_code?: string | null
    net_value?: number | null
    doc_date?: string | null
  } | null
  gl_account?: {
    gl_account_code: number
    description?: string | null
    account_category?: string | null
  } | null
  company?: {
    company_code: string
    company_name?: string | null
    country_code?: string | null
    local_currency?: string | null
  } | null
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'parked', label: 'Parked' },
  { value: 'open', label: 'Open' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'closed', label: 'Closed' },
]

const STATUS_BADGE: Record<string, string> = {
  pending_approval: 'bg-amber-100 text-amber-700',
  parked: 'bg-slate-100 text-slate-600',
  open: 'bg-emerald-100 text-emerald-700',
  blocked: 'bg-red-100 text-red-700',
  closed: 'bg-blue-100 text-blue-700',
}

function StatusBadge({ status }: { status?: string | null }) {
  const key = (status || '').toLowerCase()
  return (
    <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium capitalize', STATUS_BADGE[key] || 'bg-gray-100 text-gray-600')}>
      {status ? status.replace(/_/g, ' ') : 'Unknown'}
    </span>
  )
}

// "Things to check" hints, keyed by blocked-reason code. blocked_reason can
// be a comma-separated list of multiple codes.
const REASON_HINTS: Record<string, string> = {
  VENDOR_COUNTRY_MISMATCH:
    "The vendor's registered country doesn't match what's expected for this company code — confirm the vendor master data and this invoice belong to the correct legal entity before approving.",
  COMPANY_CODE_UNKNOWN:
    "This company code isn't recognized in the Companies master list — verify it's a valid, active company code before approving.",
  DUPLICATE_INVOICE_NO:
    'This vendor invoice number matches another invoice already in the system — check for a duplicate submission before approving to avoid a double payment.',
}

function getReasonHints(blockedReason: string): { code: string; hint: string }[] {
  return blockedReason
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)
    .map((code) => ({ code, hint: REASON_HINTS[code] || 'Review this flag before approving — no specific guidance is available for this code.' }))
}

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className='text-sm'>
      <span className='text-muted-foreground'>{label}: </span>
      <span className='font-medium text-foreground'>{value}</span>
    </div>
  )
}

// ============================================================================
// Component — replaces the old Supervity-hosted "Invoice Manual Approval
// Requests" list. Instead of scanning blocked invoices in bulk and generating
// a form per batch, a reviewer picks a pending-approval invoice here and the
// decision (status + reason) drives a single-invoice run of the
// "manual-validation" orchestrator (see app/routers/orchestrator.py).
//
// Submitting doesn't block on the workflow run (it takes on the order of a
// minute or two) — the dialog closes immediately, the invoice is hidden from
// the list while its run is in flight, and a toast reports the outcome.
// ============================================================================

export function InvoiceReviewQueue() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('pending_approval')
  const [processingDocNos, setProcessingDocNos] = useState<Set<number>>(new Set())

  const [reviewing, setReviewing] = useState<InvoiceDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [newStatus, setNewStatus] = useState<'open' | 'blocked' | ''>('')
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiClient.get<InvoiceRow[]>('/api/invoice')
      setInvoices(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load invoices')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filteredRows = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          (statusFilter === 'all' || (inv.status || '').toLowerCase() === statusFilter) &&
          !processingDocNos.has(inv.invoice_doc_no)
      ),
    [invoices, statusFilter, processingDocNos]
  )

  const openReview = useCallback(async (invoice: InvoiceRow) => {
    setReviewing({ ...invoice })
    setNewStatus('')
    setReason('')
    setDetailError(null)
    setDetailLoading(true)
    try {
      const detail = await apiClient.get<InvoiceDetail>(`/api/invoice/${invoice.invoice_doc_no}`)
      setReviewing(detail)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unable to load invoice details')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // Runs entirely in the background — the review dialog is already closed by
  // the time this settles, so completion is reported via toast instead of
  // inline dialog state.
  const runReview = useCallback(
    (docNo: number, status: 'open' | 'blocked', reasonText: string) => {
      setProcessingDocNos((prev) => new Set(prev).add(docNo))

      ;(async () => {
        let sawSuccess = true
        let failureMessage: string | null = null
        try {
          // The workflow's own audit-log step reads a `reason` field off the
          // invoice row, which our schema doesn't have — blocked_reason is
          // the closest existing column, so persist it here for the
          // decision to actually be captured.
          await apiClient.put(`/api/invoice/${docNo}`, { blocked_reason: reasonText })

          await postSSE(
            '/api/orchestrator/manual-validation/run/stream',
            (event, data) => {
              switch (event) {
                case 'error': {
                  const payload = data as { error?: string; content?: string }
                  sawSuccess = false
                  failureMessage = payload?.error || payload?.content || null
                  return
                }
                case 'result': {
                  const payload = data as { success?: boolean; message?: string }
                  if (payload?.success === false) {
                    sawSuccess = false
                    failureMessage = payload?.message || null
                  }
                  return
                }
                default:
                  return
              }
            },
            { inputs: { invoice_doc_no: String(docNo), new_status: status } }
          )
        } catch (err) {
          sawSuccess = false
          failureMessage = err instanceof Error ? err.message : null
        } finally {
          setProcessingDocNos((prev) => {
            const next = new Set(prev)
            next.delete(docNo)
            return next
          })
          await load()

          if (sawSuccess) {
            toast.success(`Invoice ${docNo} set to ${status}`)
          } else {
            toast.error(`Review failed for invoice ${docNo}`, { description: failureMessage ?? undefined })
          }
        }
      })()
    },
    [load]
  )

  const submitReview = useCallback(() => {
    if (!reviewing || !newStatus || !reason.trim()) return
    runReview(reviewing.invoice_doc_no, newStatus, reason.trim())
    setReviewing(null)
  }, [reviewing, newStatus, reason, runReview])

  const columns: DataTableColumn<InvoiceRow>[] = [
    {
      key: 'invoice_doc_no',
      label: 'Document No.',
      sortValue: (r) => r.invoice_doc_no,
      render: (r) => <span className='font-medium text-brand-navy'>{r.invoice_doc_no}</span>,
    },
    {
      key: 'vendor_invoice_no',
      label: 'Invoice No.',
      sortValue: (r) => r.vendor_invoice_no || '',
      render: (r) => r.vendor_invoice_no || '—',
    },
    {
      key: 'vendor_name',
      label: 'Vendor',
      sortValue: (r) => r.vendor?.vendor_name || '',
      render: (r) => r.vendor?.vendor_name || '—',
    },
    {
      key: 'amount',
      label: 'Amount',
      numeric: true,
      sortValue: (r) => r.amount || 0,
      render: (r) => (r.amount ? `${r.currency_code || 'USD'} ${r.amount.toLocaleString()}` : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      sortValue: (r) => r.status || '',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'review',
      label: 'Review',
      render: (r) =>
        (r.status || '').toLowerCase() === 'pending_approval' ? (
          <Button variant='outline' size='sm' className='gap-1' onClick={() => openReview(r)}>
            <Icons.edit className='h-4 w-4' />
            Review
          </Button>
        ) : (
          <span className='text-xs text-muted-foreground'>—</span>
        ),
    },
  ]

  const blockedHints = reviewing?.blocked_reason ? getReasonHints(reviewing.blocked_reason) : []

  return (
    <>
      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <Icons.fileText className='h-5 w-5 text-brand-cornflower' />
                Invoice Review Queue
              </CardTitle>
              <CardDescription>
                Invoices awaiting a decision — review a pending-approval invoice to set it open or blocked.
              </CardDescription>
            </div>
            <div className='w-full sm:w-56'>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder='Filter by status' />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>{error}</div>
          ) : isLoading ? (
            <div className='flex h-40 items-center justify-center'>
              <div className='h-10 w-10 animate-spin rounded-full border-4 border-brand-navy border-t-transparent' />
            </div>
          ) : (
            <DataTable
              rows={filteredRows}
              columns={columns}
              getRowId={(r) => String(r.invoice_doc_no)}
              searchPlaceholder='Search by document no. or invoice no.'
              searchableText={(r) => [r.invoice_doc_no, r.vendor_invoice_no].filter(Boolean).join(' ')}
              emptyMessage='No invoices match this filter.'
              defaultSortKey='invoice_doc_no'
              defaultSortDirection='desc'
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reviewing} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Review Invoice {reviewing?.invoice_doc_no}</DialogTitle>
            <DialogDescription>
              {reviewing?.vendor?.vendor_name || 'Unknown vendor'} ·{' '}
              {reviewing?.amount ? `${reviewing.currency_code || 'USD'} ${reviewing.amount.toLocaleString()}` : '—'}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className='flex h-32 items-center justify-center'>
              <Icons.loader className='h-6 w-6 animate-spin text-brand-cornflower' />
            </div>
          ) : detailError ? (
            <div className='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>{detailError}</div>
          ) : (
            reviewing && (
              <div className='max-h-[65vh] space-y-4 overflow-y-auto pr-1'>
                {blockedHints.length > 0 && (
                  <div className='space-y-2'>
                    {blockedHints.map(({ code, hint }) => (
                      <div key={code} className='flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3'>
                        <Icons.alertTriangle className='mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600' />
                        <div>
                          <p className='text-xs font-semibold uppercase tracking-wide text-amber-800'>{code}</p>
                          <p className='mt-0.5 text-sm text-amber-800'>{hint}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <p className='mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Invoice</p>
                  <div className='grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-gray-50 p-3 sm:grid-cols-3'>
                    <DetailRow label='Vendor Invoice #' value={reviewing.vendor_invoice_no} />
                    <DetailRow label='Fiscal Year' value={reviewing.fiscal_year} />
                    <DetailRow label='Document Date' value={reviewing.document_date} />
                    <DetailRow label='Posting Date' value={reviewing.posting_date} />
                    <DetailRow label='Tax Code' value={reviewing.tax_code} />
                    <DetailRow label='Tax Amount' value={reviewing.tax_amount} />
                    <DetailRow label='Source Channel' value={reviewing.source_channel} />
                    <DetailRow label='Bank Account on Invoice' value={reviewing.bank_account_on_invoice} />
                    <DetailRow
                      label='Extraction Confidence'
                      value={
                        typeof reviewing.extraction_confidence === 'number'
                          ? `${Math.round(reviewing.extraction_confidence * 100)}%`
                          : undefined
                      }
                    />
                  </div>
                </div>

                {reviewing.vendor && (
                  <div>
                    <p className='mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                      Vendor Master Data
                    </p>
                    <div className='grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-3'>
                      <DetailRow label='Tax ID' value={reviewing.vendor.tax_id} />
                      <DetailRow label='Country' value={reviewing.vendor.country_code} />
                      <DetailRow label='Bank Country' value={reviewing.vendor.bank_country} />
                      <DetailRow label='Bank Key' value={reviewing.vendor.bank_key} />
                      <DetailRow label='Bank Account #' value={reviewing.vendor.bank_account_number} />
                      <DetailRow label='Email' value={reviewing.vendor.email} />
                      <DetailRow label='Blocked' value={reviewing.vendor.is_blocked ? 'Yes' : undefined} />
                    </div>
                  </div>
                )}

                {(reviewing.po_id || reviewing.gl_account_code || reviewing.company_code_on_invoice) && (
                  <div>
                    <p className='mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                      Purchase Order / GL / Company
                    </p>
                    <div className='grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-3'>
                      <DetailRow label='PO ID' value={reviewing.po_id} />
                      <DetailRow
                        label='PO Status'
                        value={reviewing.purchase_order?.process_status ?? (reviewing.po_id ? 'Not found' : undefined)}
                      />
                      <DetailRow label='PO Net Value' value={reviewing.purchase_order?.net_value} />
                      <DetailRow label='GL Account' value={reviewing.gl_account_code} />
                      <DetailRow
                        label='GL Description'
                        value={reviewing.gl_account?.description ?? (reviewing.gl_account_code ? 'Not found' : undefined)}
                      />
                      <DetailRow label='Company Code (on invoice)' value={reviewing.company_code_on_invoice} />
                      <DetailRow
                        label='Company Name'
                        value={reviewing.company?.company_name ?? (reviewing.company_code_on_invoice ? 'Not found' : undefined)}
                      />
                    </div>
                  </div>
                )}

                <div className='grid gap-4 sm:grid-cols-2'>
                  <div>
                    <Label>New Status *</Label>
                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as 'open' | 'blocked')}>
                      <SelectTrigger className='mt-1.5'>
                        <SelectValue placeholder='Choose status…' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='open'>Open</SelectItem>
                        <SelectItem value='blocked'>Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Reason *</Label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder='Explain why this invoice is being approved or blocked…'
                      rows={2}
                      className='mt-1.5 w-full resize-none rounded-lg border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-cornflower/50'
                    />
                  </div>
                </div>
              </div>
            )
          )}

          <DialogFooter>
            <Button variant='outline' onClick={() => setReviewing(null)}>
              Cancel
            </Button>
            <Button variant='gradient' onClick={submitReview} disabled={!newStatus || !reason.trim() || detailLoading}>
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
