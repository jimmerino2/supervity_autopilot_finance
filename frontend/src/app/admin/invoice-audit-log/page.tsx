'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { apiClient } from '@/lib/api-client'
import { DataTable, DataTableColumn } from '@/components/common/DataTable'
import { Icons } from '@/components/ui/icons'

export interface InvoiceAuditLogRecord {
  id: number
  created_at: string
  created_by: string
  invoice_doc_no: number
  type: string
  status: string
  reason: string | null
  invoices?: {
    vendor_id: number | null
    vendor_invoice_no: string | null
  } | null
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  blocked: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700'
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', tone)}>{status.replace(/_/g, ' ')}</span>
}

const columns: DataTableColumn<InvoiceAuditLogRecord>[] = [
  {
    key: 'invoice_doc_no',
    label: 'Document No',
    sortValue: (r) => r.invoice_doc_no,
    render: (r) => (
      <Link href={`/admin/invoices?invoice_doc_no=${r.invoice_doc_no}`} className='text-brand-cornflower hover:underline'>
        {r.invoice_doc_no}
      </Link>
    ),
  },
  {
    key: 'vendor_invoice_no',
    label: 'Vendor Invoice No',
    sortValue: (r) => r.invoices?.vendor_invoice_no ?? '',
    render: (r) => r.invoices?.vendor_invoice_no || '—',
  },
  { key: 'type', label: 'Type', sortValue: (r) => r.type, render: (r) => r.type },
  { key: 'status', label: 'Status', sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  { key: 'reason', label: 'Reason', sortValue: (r) => r.reason ?? '', render: (r) => r.reason || '—' },
  { key: 'created_by', label: 'Created By', sortValue: (r) => r.created_by, render: (r) => r.created_by },
  {
    key: 'created_at',
    label: 'Created At',
    sortValue: (r) => r.created_at,
    render: (r) => new Date(r.created_at).toLocaleString(),
  },
]

export default function InvoiceAuditLogPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [rows, setRows] = useState<InvoiceAuditLogRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      const data = await apiClient.get<InvoiceAuditLogRecord[]>('/api/invoice_audit_log')
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the invoice audit log')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-sm uppercase tracking-[0.2em] text-brand-cornflower'>Procurement</p>
            <h1 className='text-display-4 font-bold text-brand-navy'>Audit Log</h1>
          </div>
          <div className='flex items-center gap-2'>
            <Icons.fileText className='h-6 w-6 text-brand-navy' />
            <span className='text-sm text-muted-foreground'>Automated validation and status history for equipment, maintenance, and subscription invoices.</span>
          </div>
        </div>

        <p className='max-w-2xl text-sm text-muted-foreground'>
          Read-only. Search by vendor invoice number to find the audit trail for a specific invoice.
        </p>
      </div>

      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <CardTitle>Invoice Audit Log</CardTitle>
          <CardDescription>
            A full history of every automated and manual change made to an invoice.
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
              getRowId={(r) => String(r.id)}
              searchPlaceholder='Search by vendor invoice no.'
              searchableText={(r) => r.invoices?.vendor_invoice_no ?? ''}
              emptyMessage='No audit log records found.'
              defaultSortKey='created_at'
              defaultSortDirection='desc'
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
