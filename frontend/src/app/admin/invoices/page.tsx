'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api-client'
import { Icons } from '@/components/ui/icons'
import { InvoicesTable, InvoiceRecord, parseAmount } from '@/components/invoices/InvoicesTable'

const defaultInvoiceForm = {
  vendor_invoice_no: '',
  vendor_name: '',
  status: 'pending approval',
  amount: 0,
  currency_code: 'MYR',
  document_date: '',
  posting_date: '',
}

export default function AdminInvoicesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [formValues, setFormValues] = useState(defaultInvoiceForm)

  const isAdmin = session?.roles?.includes('admin')
  const approverRange =
    session?.user?.minAmount != null && session?.user?.maxAmount != null
      ? { min: session.user.minAmount, max: session.user.maxAmount }
      : null

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

    fetchInvoices()
  }, [status, isAdmin, router])

  const fetchInvoices = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await apiClient.get<InvoiceRecord[]>('/api/invoice')
      setInvoices(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load invoices')
    } finally {
      setIsLoading(false)
    }
  }

  const openViewDialog = (invoice: InvoiceRecord) => {
    setSelectedInvoice(invoice)
    setFormValues({
      vendor_invoice_no: invoice.vendor_invoice_no || '',
      vendor_name: invoice.vendor?.vendor_name || '',
      status: invoice.status || 'pending approval',
      amount: invoice.amount || 0,
      currency_code: invoice.currency_code || 'MYR',
      document_date: invoice.document_date || '',
      posting_date: invoice.posting_date || '',
    })
    setViewDialogOpen(true)
  }

  const handleStatusChange = async (invoice: InvoiceRecord, nextStatus: string) => {
    setActionLoading(true)
    setError(null)

    try {
      await apiClient.put(`/api/invoice/${invoice.invoice_doc_no}`, { status: nextStatus })
      await fetchInvoices()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update invoice status')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-sm uppercase tracking-[0.2em] text-brand-cornflower'>Invoices</p>
            <h1 className='text-display-4 font-bold text-brand-navy'>Invoice Review</h1>
          </div>
          <div className='flex items-center gap-2'>
            <Icons.fileText className='h-6 w-6 text-brand-navy' />
            <span className='text-sm text-muted-foreground'>Review invoices and approve or block them.</span>
          </div>
        </div>

        <p className='max-w-2xl text-sm text-muted-foreground'>
          Invoices can only move from pending approval to open or blocked, and from open to paid or cancelled.
        </p>
      </div>

      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>
            Records are loaded from the backend endpoint <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>/api/invoice</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'loading' || isLoading ? (
            <div className='flex h-72 items-center justify-center'>
              <div className='h-10 w-10 animate-spin rounded-full border-4 border-brand-navy border-t-transparent' />
            </div>
          ) : error ? (
            <div className='rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700'>
              {error}
            </div>
          ) : (
            <InvoicesTable
              rows={invoices}
              onView={openViewDialog}
              onStatusChange={handleStatusChange}
              approverRange={approverRange}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className='sm:max-w-xl'>
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>View the invoice fields and current workflow status.</DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className='space-y-4 py-2'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Invoice No.</Label>
                  <p className='mt-1 text-sm'>{selectedInvoice.vendor_invoice_no || '—'}</p>
                </div>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Document No.</Label>
                  <p className='mt-1 text-sm'>{selectedInvoice.invoice_doc_no}</p>
                </div>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Vendor</Label>
                  <p className='mt-1 text-sm'>{selectedInvoice.vendor?.vendor_name || '—'}</p>
                </div>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Status</Label>
                  <p className='mt-1 text-sm'>{selectedInvoice.status?.toUpperCase() || 'Unknown'}</p>
                </div>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Amount</Label>
                  <p className='mt-1 text-sm'>
                    {selectedInvoice.amount ? `${selectedInvoice.currency_code || 'USD'} ${selectedInvoice.amount.toLocaleString()}` : '—'}
                  </p>
                </div>
                <div>
                  <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>Posting Date</Label>
                  <p className='mt-1 text-sm'>{selectedInvoice.posting_date || '—'}</p>
                </div>
              </div>

              <div className='rounded-2xl border border-dashed border-border/60 bg-slate-50 p-4'>
                <p className='text-sm text-muted-foreground'>Current workflow rules:</p>
                <ul className='mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground'>
                  <li>Pending approval → Open or Blocked</li>
                  <li>Open → Paid or Cancelled</li>
                </ul>
                {selectedInvoice.status?.toLowerCase() === 'open' && (
                  <p className='mt-2 text-sm text-muted-foreground'>
                    {approverRange
                      ? `Your approval range: ${approverRange.min.toLocaleString()} – ${approverRange.max.toLocaleString()}`
                      : 'Loading your approval range…'}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className='flex justify-end gap-2'>
            <Button variant='outline' onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            {selectedInvoice && ['pending approval', 'open'].includes((selectedInvoice.status || '').toLowerCase()) && (() => {
              const isPayAction = selectedInvoice.status?.toLowerCase() === 'open'
              const amount = parseAmount(selectedInvoice.amount)
              const outOfRange =
                isPayAction &&
                (!approverRange || amount == null || amount < approverRange.min || amount > approverRange.max)

              return (
                <Button
                  disabled={outOfRange}
                  title={outOfRange ? 'This invoice amount is outside your approval range' : undefined}
                  onClick={() =>
                    handleStatusChange(selectedInvoice, isPayAction ? 'paid' : 'open')
                  }
                >
                  {isPayAction ? 'Mark Paid' : 'Approve to Open'}
                </Button>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
