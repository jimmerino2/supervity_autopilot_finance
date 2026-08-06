'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiClient } from '@/lib/api-client'
import { DataTable, DataTableColumn } from '@/components/common/DataTable'
import { Icons } from '@/components/ui/icons'

export interface InvoiceLogRecord {
  invoice_doc_no: number
  vendor_invoice_no: string
  vendor_id: number | null
  po_id: number | null
  document_date: string | null
  posting_date: string | null
  currency_code: string
  amount: string
  tax_code: string | null
  tax_amount: number | null
  source_channel: string
  bank_account_on_invoice: string | null
  gl_account_code: number | null
  status: string
  created_by_user: string
  submitted_at: string
  extraction_confidence: number | null
  company_code_on_invoice: string | null
  po_currency: string | null
  tags: string | null
  vendor?: { vendor_name?: string }
  purchase_order?: { po_id: number; doc_type?: string; net_value?: number; currency_code?: string }
  company?: { company_name?: string }
}

function statusBadge(status: string) {
  const normalized = status.toLowerCase()
  const tone =
    normalized === 'parked'
      ? 'bg-amber-100 text-amber-700'
      : normalized === 'posted'
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-slate-100 text-slate-700'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>
}

const columns: DataTableColumn<InvoiceLogRecord>[] = [
  {
    key: 'invoice_doc_no',
    label: 'Invoice Doc No',
    sortValue: (r) => r.invoice_doc_no,
    render: (r) => r.invoice_doc_no,
  },
  { key: 'vendor_invoice_no', label: 'Vendor Invoice No', sortValue: (r) => r.vendor_invoice_no, render: (r) => r.vendor_invoice_no },
  {
    key: 'vendor_id',
    label: 'Vendor',
    sortValue: (r) => r.vendor?.vendor_name ?? String(r.vendor_id ?? ''),
    render: (r) => r.vendor?.vendor_name ?? r.vendor_id ?? '—',
  },
  {
    key: 'po_id',
    label: 'PO ID',
    numeric: true,
    sortValue: (r) => r.po_id ?? undefined,
    render: (r) =>
      r.po_id ? (
        <Link href={`/admin/purchase-orders?po_id=${r.po_id}`} className='text-brand-cornflower hover:underline'>
          {r.po_id}
        </Link>
      ) : (
        '—'
      ),
  },
  {
    key: 'amount',
    label: 'Amount',
    numeric: true,
    sortValue: (r) => Number(r.amount),
    render: (r) => `${r.currency_code} ${Number(r.amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
  },
  { key: 'source_channel', label: 'Source', sortValue: (r) => r.source_channel, render: (r) => r.source_channel },
  { key: 'status', label: 'Status', sortValue: (r) => r.status, render: (r) => statusBadge(r.status) },
  {
    key: 'submitted_at',
    label: 'Submitted',
    sortValue: (r) => r.submitted_at,
    render: (r) => new Date(r.submitted_at).toLocaleString(),
  },
  { key: 'tags', label: 'Tags', sortValue: (r) => r.tags ?? undefined, render: (r) => r.tags ?? '—' },
]

export default function AdminInvoicesLogPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [rows, setRows] = useState<InvoiceLogRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<InvoiceLogRecord | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  const isAdmin = session?.roles?.includes('admin')

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }

    if (!isAdmin) {
      router.push('/')
      return
    }

    fetchRows()
  }, [status, isAdmin, router])

  const fetchRows = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await apiClient.get<InvoiceLogRecord[]>('/api/invoices_log')
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load invoice intake log')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-sm uppercase tracking-[0.2em] text-brand-cornflower'>Ingestion</p>
            <h1 className='text-display-4 font-bold text-brand-navy'>Invoice Intake Log</h1>
          </div>
          <div className='flex items-center gap-2'>
            <Icons.fileText className='h-6 w-6 text-brand-navy' />
            <span className='text-sm text-muted-foreground'>Raw extraction log, separate from the posted Invoices ledger.</span>
          </div>
        </div>

        <p className='max-w-2xl text-sm text-muted-foreground'>
          Read-only. This is the raw AI-extraction capture (its own <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>invoice_doc_no</code>{' '}
          numbering, distinct from the Invoices module). <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>vendor_id</code>,{' '}
          <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>po_id</code>, and{' '}
          <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>company_code_on_invoice</code> are real foreign keys
          into Vendors, Purchase Orders, and Companies, so they&apos;re shown by name/link below.{' '}
          <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>gl_account_code</code> is still a plain extracted
          value with no database foreign key to GL Accounts.
        </p>
      </div>

      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <CardTitle>Intake Records</CardTitle>
          <CardDescription>
            Records are loaded from the backend endpoint <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>/api/invoices_log</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'loading' || isLoading ? (
            <div className='flex h-72 items-center justify-center'>
              <div className='h-10 w-10 animate-spin rounded-full border-4 border-brand-navy border-t-transparent' />
            </div>
          ) : error ? (
            <div className='rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700'>{error}</div>
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              getRowId={(r) => String(r.invoice_doc_no)}
              searchPlaceholder='Search by vendor invoice no, vendor, source, or status'
              searchableText={(r) =>
                [r.vendor_invoice_no, r.vendor?.vendor_name, r.source_channel, r.status, r.tags ?? '']
                  .filter(Boolean)
                  .join(' ')
              }
              onView={(r) => {
                setSelected(r)
                setViewOpen(true)
              }}
              emptyMessage='No invoice intake records found.'
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className='sm:max-w-3xl'>
          <DialogHeader>
            <DialogTitle>Invoice Intake Record</DialogTitle>
            <DialogDescription>Doc No {selected?.invoice_doc_no}</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className='grid gap-4 py-2 sm:grid-cols-3'>
              <Field label='Vendor Invoice No' value={selected.vendor_invoice_no} />
              <Field label='Vendor' value={selected.vendor?.vendor_name ?? selected.vendor_id ?? '—'} />
              <Field
                label='Purchase Order'
                value={
                  selected.po_id ? (
                    <Link href={`/admin/purchase-orders?po_id=${selected.po_id}`} className='text-brand-cornflower hover:underline'>
                      {selected.po_id}
                      {selected.purchase_order?.doc_type ? ` (${selected.purchase_order.doc_type})` : ''}
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <Field label='Document Date' value={selected.document_date ?? '—'} />
              <Field label='Posting Date' value={selected.posting_date ?? '—'} />
              <Field label='Currency' value={selected.currency_code} />
              <Field label='Amount' value={Number(selected.amount).toLocaleString('en-US', { maximumFractionDigits: 2 })} />
              <Field label='Tax Code' value={selected.tax_code ?? '—'} />
              <Field label='Tax Amount' value={selected.tax_amount ?? '—'} />
              <Field label='Source Channel' value={selected.source_channel} />
              <Field label='Bank Account (on invoice)' value={selected.bank_account_on_invoice ?? '—'} />
              <Field label='GL Account (unlinked)' value={selected.gl_account_code ?? '—'} />
              <Field label='Status' value={statusBadge(selected.status)} />
              <Field label='Created By' value={selected.created_by_user} />
              <Field label='Submitted' value={new Date(selected.submitted_at).toLocaleString()} />
              <Field label='Extraction Confidence' value={selected.extraction_confidence != null ? `${Math.round(selected.extraction_confidence * 100)}%` : '—'} />
              <Field label='Company' value={selected.company?.company_name ?? selected.company_code_on_invoice ?? '—'} />
              <Field label='PO Currency' value={selected.po_currency ?? '—'} />
              <Field label='Tags' value={selected.tags ?? '—'} />
            </div>
          )}

          <DialogFooter>
            <Button variant='outline' onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>{label}</Label>
      <p className='mt-1 text-sm'>{value}</p>
    </div>
  )
}
