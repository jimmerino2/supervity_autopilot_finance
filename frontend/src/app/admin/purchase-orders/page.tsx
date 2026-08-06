'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

export interface GoodsReceiptEntry {
  material_doc_no: number
  material_doc_line: number
  po_id: number
  po_line_no: number
  movement_type: string
  posting_date: string
  quantity: number
  unit_of_measure: string
  material_no: string
  plant: string
  debit_credit_indicator: string
}

export interface PurchaseOrderLineEntry {
  po_id: number
  line_no: number
  description: string
  material_no: string
  plant: string
  material_group: string
  quantity: number
  unit_of_measure: string
  net_price: number
  price_unit: number
  net_value: number
  tax_code: string
  over_tolerance_pct: number
  under_tolerance_pct: number
  is_final_delivery: boolean
  account_assignment_category: string
  goods_receipt?: GoodsReceiptEntry[]
}

export interface PurchaseOrderRecord {
  po_id: number
  company_code: string
  doc_type: string
  vendor_id: number
  purchasing_org: string
  purchasing_group: string
  currency_code: string
  payment_terms: string
  doc_date: string
  created_by: string
  process_status: string
  exchange_rate: number
  validity_start_date: string
  validity_end_date: string
  net_value: number
  vendor?: { vendor_name?: string }
  company?: { company_name?: string }
  purchase_order_line?: PurchaseOrderLineEntry[]
}

const columns: DataTableColumn<PurchaseOrderRecord>[] = [
  { key: 'po_id', label: 'PO ID', sortValue: (r) => r.po_id, render: (r) => r.po_id },
  {
    key: 'company_code',
    label: 'Company',
    sortValue: (r) => r.company?.company_name ?? r.company_code,
    render: (r) => r.company?.company_name ?? r.company_code,
  },
  {
    key: 'vendor_id',
    label: 'Vendor',
    sortValue: (r) => r.vendor?.vendor_name ?? String(r.vendor_id),
    render: (r) => r.vendor?.vendor_name ?? r.vendor_id,
  },
  { key: 'doc_type', label: 'Doc Type', sortValue: (r) => r.doc_type, render: (r) => r.doc_type },
  { key: 'process_status', label: 'Status', sortValue: (r) => r.process_status, render: (r) => r.process_status },
  {
    key: 'net_value',
    label: 'Net Value',
    numeric: true,
    sortValue: (r) => r.net_value,
    render: (r) => `${r.currency_code} ${r.net_value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
  },
  {
    key: 'doc_date',
    label: 'Doc Date',
    sortValue: (r) => r.doc_date,
    render: (r) => new Date(r.doc_date).toLocaleDateString(),
  },
]

function AdminPurchaseOrdersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [rows, setRows] = useState<PurchaseOrderRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PurchaseOrderRecord | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
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

  useEffect(() => {
    const poId = searchParams.get('po_id')
    if (poId) {
      openViewDialog(Number(poId))
    }
  }, [searchParams])

  const fetchRows = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await apiClient.get<PurchaseOrderRecord[]>('/api/purchase_order')
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load purchase orders')
    } finally {
      setIsLoading(false)
    }
  }

  const openViewDialog = async (poId: number) => {
    setViewOpen(true)
    setDetailLoading(true)
    setError(null)

    try {
      const data = await apiClient.get<PurchaseOrderRecord>(`/api/purchase_order/${poId}`)
      setSelected(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load purchase order detail')
    } finally {
      setDetailLoading(false)
    }
  }

  const allReceipts = (selected?.purchase_order_line || []).flatMap((line) =>
    (line.goods_receipt || []).map((gr) => ({ ...gr, line_no: line.line_no, line_description: line.description }))
  )

  return (
    <div className='space-y-6'>
      <div>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-sm uppercase tracking-[0.2em] text-brand-cornflower'>Procurement</p>
            <h1 className='text-display-4 font-bold text-brand-navy'>Purchase Orders</h1>
          </div>
          <div className='flex items-center gap-2'>
            <Icons.folder className='h-6 w-6 text-brand-navy' />
            <span className='text-sm text-muted-foreground'>Read-only. View a PO for its line items and goods receipts.</span>
          </div>
        </div>

        <p className='max-w-2xl text-sm text-muted-foreground'>
          <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>vendor_id</code> and{' '}
          <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>company_code</code> are real foreign keys into
          Vendors and Companies, so both are shown by name below.{' '}
          <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>purchase_order_line.po_id</code> is also a real
          foreign key to this table, and <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>goods_receipt</code> has
          a real composite foreign key into each line — both are nested below.
        </p>
      </div>

      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <CardTitle>Purchase Orders</CardTitle>
          <CardDescription>
            Records are loaded from the backend endpoint <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>/api/purchase_order</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'loading' || isLoading ? (
            <div className='flex h-72 items-center justify-center'>
              <div className='h-10 w-10 animate-spin rounded-full border-4 border-brand-navy border-t-transparent' />
            </div>
          ) : error && !viewOpen ? (
            <div className='rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700'>{error}</div>
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              getRowId={(r) => String(r.po_id)}
              searchPlaceholder='Search by PO ID, company, or vendor'
              searchableText={(r) =>
                [String(r.po_id), r.company_code, r.company?.company_name, String(r.vendor_id), r.vendor?.vendor_name, r.doc_type]
                  .filter(Boolean)
                  .join(' ')
              }
              onView={(r) => openViewDialog(r.po_id)}
              emptyMessage='No purchase orders found.'
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className='sm:max-w-4xl'>
          <DialogHeader>
            <DialogTitle>Purchase Order {selected?.po_id}</DialogTitle>
            <DialogDescription>Header, line items, and goods receipts.</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className='flex h-40 items-center justify-center'>
              <div className='h-8 w-8 animate-spin rounded-full border-4 border-brand-navy border-t-transparent' />
            </div>
          ) : selected ? (
            <div className='max-h-[70vh] space-y-6 overflow-y-auto py-2'>
              <div className='grid gap-4 sm:grid-cols-4'>
                <Field label='Company' value={selected.company?.company_name ?? selected.company_code} />
                <Field label='Vendor' value={selected.vendor?.vendor_name ?? selected.vendor_id} />
                <Field label='Doc Type' value={selected.doc_type} />
                <Field label='Status' value={selected.process_status} />
                <Field label='Purchasing Org' value={selected.purchasing_org} />
                <Field label='Purchasing Group' value={selected.purchasing_group} />
                <Field label='Payment Terms' value={selected.payment_terms} />
                <Field label='Doc Date' value={new Date(selected.doc_date).toLocaleDateString()} />
                <Field
                  label='Net Value'
                  value={`${selected.currency_code} ${selected.net_value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
                />
                <Field label='Exchange Rate' value={selected.exchange_rate} />
                <Field label='Valid From' value={new Date(selected.validity_start_date).toLocaleDateString()} />
                <Field
                  label='Valid To'
                  value={
                    selected.validity_end_date?.startsWith('9999')
                      ? 'Open'
                      : new Date(selected.validity_end_date).toLocaleDateString()
                  }
                />
              </div>

              <div>
                <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>
                  Line Items ({selected.purchase_order_line?.length ?? 0})
                </Label>
                <div className='mt-2 overflow-x-auto rounded-2xl border border-border'>
                  <table className='min-w-full divide-y divide-border text-sm'>
                    <thead className='bg-slate-50'>
                      <tr>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Line</th>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Description</th>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Material</th>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Plant</th>
                        <th className='px-3 py-2 text-right font-medium text-slate-600'>Quantity</th>
                        <th className='px-3 py-2 text-right font-medium text-slate-600'>Net Price</th>
                        <th className='px-3 py-2 text-right font-medium text-slate-600'>Net Value</th>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Final Delivery</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-border bg-white'>
                      {(selected.purchase_order_line || []).length > 0 ? (
                        selected.purchase_order_line!.map((line) => (
                          <tr key={`${line.po_id}-${line.line_no}`}>
                            <td className='px-3 py-2'>{line.line_no}</td>
                            <td className='px-3 py-2'>{line.description}</td>
                            <td className='px-3 py-2'>{line.material_no}</td>
                            <td className='px-3 py-2'>{line.plant}</td>
                            <td className='px-3 py-2 text-right'>
                              {line.quantity.toLocaleString()} {line.unit_of_measure}
                            </td>
                            <td className='px-3 py-2 text-right'>{line.net_price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                            <td className='px-3 py-2 text-right'>{line.net_value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                            <td className='px-3 py-2'>{line.is_final_delivery ? 'Yes' : 'No'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className='px-3 py-4 text-center text-muted-foreground'>
                            No line items available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>
                  Goods Receipts ({allReceipts.length})
                </Label>
                <div className='mt-2 overflow-x-auto rounded-2xl border border-border'>
                  <table className='min-w-full divide-y divide-border text-sm'>
                    <thead className='bg-slate-50'>
                      <tr>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Line</th>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Material Doc</th>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Movement</th>
                        <th className='px-3 py-2 text-right font-medium text-slate-600'>Quantity</th>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Posting Date</th>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Plant</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-border bg-white'>
                      {allReceipts.length > 0 ? (
                        allReceipts.map((gr) => (
                          <tr key={`${gr.material_doc_no}-${gr.material_doc_line}`}>
                            <td className='px-3 py-2'>{gr.line_no}</td>
                            <td className='px-3 py-2'>
                              {gr.material_doc_no}-{gr.material_doc_line}
                            </td>
                            <td className='px-3 py-2'>{gr.movement_type}</td>
                            <td className='px-3 py-2 text-right'>
                              {gr.quantity.toLocaleString()} {gr.unit_of_measure}
                            </td>
                            <td className='px-3 py-2'>{new Date(gr.posting_date).toLocaleDateString()}</td>
                            <td className='px-3 py-2'>{gr.plant}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className='px-3 py-4 text-center text-muted-foreground'>
                            No goods receipts posted yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className='rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700'>{error}</div>
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

export default function AdminPurchaseOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className='flex h-72 items-center justify-center'>
          <div className='h-10 w-10 animate-spin rounded-full border-4 border-brand-navy border-t-transparent' />
        </div>
      }
    >
      <AdminPurchaseOrdersContent />
    </Suspense>
  )
}
