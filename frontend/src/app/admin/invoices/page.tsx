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
import { InvoicesTable, InvoiceRecord } from '@/components/invoices/InvoicesTable'

export default function AdminInvoicesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)

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
    setViewDialogOpen(true)
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
            <span className='text-sm text-muted-foreground'>Read-only view of invoice records.</span>
          </div>
        </div>

        <p className='max-w-2xl text-sm text-muted-foreground'>
          This page is read-only — invoice statuses can&apos;t be changed here.
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
            <InvoicesTable rows={invoices} onView={openViewDialog} />
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
            </div>
          )}

          <div className='flex justify-end gap-2'>
            <Button variant='outline' onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
