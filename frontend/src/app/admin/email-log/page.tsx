'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
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

export interface EmailLogRecord {
  email_id: string
  invoice_doc_no: number | null
  vendor_id: number | null
  from_address: string
  to_address: string
  subject: string
  received_at: string
  spf_result: string | null
  dkim_result: string | null
  dmarc_result: string | null
  message_type: string
  attachment_name: string | null
  vendor?: { vendor_name?: string }
}

function authBadge(value: string | null) {
  if (!value) return '—'
  const passed = value.toLowerCase() === 'pass'
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {value}
    </span>
  )
}

const columns: DataTableColumn<EmailLogRecord>[] = [
  {
    key: 'received_at',
    label: 'Received',
    sortValue: (r) => r.received_at,
    render: (r) => new Date(r.received_at).toLocaleString(),
  },
  { key: 'from_address', label: 'From', sortValue: (r) => r.from_address, render: (r) => r.from_address },
  { key: 'subject', label: 'Subject', sortValue: (r) => r.subject, render: (r) => <span className='max-w-xs truncate'>{r.subject}</span> },
  { key: 'message_type', label: 'Type', sortValue: (r) => r.message_type, render: (r) => r.message_type },
  {
    key: 'vendor_id',
    label: 'Vendor',
    sortValue: (r) => r.vendor?.vendor_name ?? String(r.vendor_id ?? ''),
    render: (r) => r.vendor?.vendor_name ?? r.vendor_id ?? '—',
  },
  {
    key: 'invoice_doc_no',
    label: 'Invoice Doc No',
    numeric: true,
    sortValue: (r) => r.invoice_doc_no ?? undefined,
    render: (r) => r.invoice_doc_no ?? '—',
  },
  { key: 'spf_result', label: 'SPF', render: (r) => authBadge(r.spf_result) },
  { key: 'dkim_result', label: 'DKIM', render: (r) => authBadge(r.dkim_result) },
  { key: 'dmarc_result', label: 'DMARC', render: (r) => authBadge(r.dmarc_result) },
]

export default function AdminEmailLogPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [rows, setRows] = useState<EmailLogRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<EmailLogRecord | null>(null)
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
      const data = await apiClient.get<EmailLogRecord[]>('/api/email_log')
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load email log')
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
            <h1 className='text-display-4 font-bold text-brand-navy'>Email Log</h1>
          </div>
          <div className='flex items-center gap-2'>
            <Icons.mail className='h-6 w-6 text-brand-navy' />
            <span className='text-sm text-muted-foreground'>Inbound mailbox events captured for invoice intake.</span>
          </div>
        </div>

        <p className='max-w-2xl text-sm text-muted-foreground'>
          Read-only. <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>vendor_id</code> is a real foreign key
          into Vendors, so it&apos;s shown by name below. <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>invoice_doc_no</code>{' '}
          is still captured as a plain value with no database foreign key back to Invoices.
        </p>
      </div>

      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <CardTitle>Messages</CardTitle>
          <CardDescription>
            Records are loaded from the backend endpoint <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>/api/email_log</code>.
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
              getRowId={(r) => r.email_id}
              searchPlaceholder='Search by sender, subject, vendor, or message type'
              searchableText={(r) =>
                [r.from_address, r.to_address, r.subject, r.message_type, r.vendor?.vendor_name].filter(Boolean).join(' ')
              }
              onView={(r) => {
                setSelected(r)
                setViewOpen(true)
              }}
              emptyMessage='No email log entries found.'
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Email Log Entry</DialogTitle>
            <DialogDescription>{selected?.email_id}</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className='grid gap-4 py-2 sm:grid-cols-2'>
              <div>
                <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>From</Label>
                <p className='mt-1 text-sm'>{selected.from_address}</p>
              </div>
              <div>
                <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>To</Label>
                <p className='mt-1 text-sm'>{selected.to_address}</p>
              </div>
              <div className='sm:col-span-2'>
                <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Subject</Label>
                <p className='mt-1 text-sm'>{selected.subject}</p>
              </div>
              <div>
                <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Received</Label>
                <p className='mt-1 text-sm'>{new Date(selected.received_at).toLocaleString()}</p>
              </div>
              <div>
                <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Message Type</Label>
                <p className='mt-1 text-sm'>{selected.message_type}</p>
              </div>
              <div>
                <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Vendor</Label>
                <p className='mt-1 text-sm'>{selected.vendor?.vendor_name ?? selected.vendor_id ?? '—'}</p>
              </div>
              <div>
                <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Invoice Doc No (unlinked)</Label>
                <p className='mt-1 text-sm'>{selected.invoice_doc_no ?? '—'}</p>
              </div>
              <div>
                <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Attachment</Label>
                <p className='mt-1 text-sm'>{selected.attachment_name ?? '—'}</p>
              </div>
              <div className='flex gap-4 sm:col-span-2'>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>SPF</Label>
                  <p className='mt-1 text-sm'>{authBadge(selected.spf_result)}</p>
                </div>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>DKIM</Label>
                  <p className='mt-1 text-sm'>{authBadge(selected.dkim_result)}</p>
                </div>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>DMARC</Label>
                  <p className='mt-1 text-sm'>{authBadge(selected.dmarc_result)}</p>
                </div>
              </div>
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
