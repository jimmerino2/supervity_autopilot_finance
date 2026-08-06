'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { apiClient } from '@/lib/api-client'
import { DataTable, DataTableColumn } from '@/components/common/DataTable'
import { Icons } from '@/components/ui/icons'

export interface GoodsReceiptRecord {
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

const columns: DataTableColumn<GoodsReceiptRecord>[] = [
  { key: 'material_doc_no', label: 'Material Doc No', sortValue: (r) => r.material_doc_no, render: (r) => r.material_doc_no },
  { key: 'material_doc_line', label: 'Line', numeric: true, sortValue: (r) => r.material_doc_line, render: (r) => r.material_doc_line },
  {
    key: 'po_id',
    label: 'PO ID',
    numeric: true,
    sortValue: (r) => r.po_id,
    render: (r) => (
      <Link href={`/admin/purchase-orders?po_id=${r.po_id}`} className='text-brand-cornflower hover:underline'>
        {r.po_id}
      </Link>
    ),
  },
  { key: 'po_line_no', label: 'PO Line', numeric: true, sortValue: (r) => r.po_line_no, render: (r) => r.po_line_no },
  { key: 'material_no', label: 'Material', sortValue: (r) => r.material_no, render: (r) => r.material_no },
  { key: 'plant', label: 'Plant', sortValue: (r) => r.plant, render: (r) => r.plant },
  { key: 'movement_type', label: 'Movement', sortValue: (r) => r.movement_type, render: (r) => r.movement_type },
  {
    key: 'quantity',
    label: 'Quantity',
    numeric: true,
    sortValue: (r) => r.quantity,
    render: (r) => `${r.quantity.toLocaleString()} ${r.unit_of_measure}`,
  },
  {
    key: 'posting_date',
    label: 'Posting Date',
    sortValue: (r) => r.posting_date,
    render: (r) => new Date(r.posting_date).toLocaleDateString(),
  },
]

export default function AdminGoodsReceiptsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [rows, setRows] = useState<GoodsReceiptRecord[]>([])
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
      const data = await apiClient.get<GoodsReceiptRecord[]>('/api/goods_receipt')
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load goods receipts')
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
            <h1 className='text-display-4 font-bold text-brand-navy'>Goods Receipts</h1>
          </div>
          <div className='flex items-center gap-2'>
            <Icons.archive className='h-6 w-6 text-brand-navy' />
            <span className='text-sm text-muted-foreground'>Material movements posted against purchase order lines.</span>
          </div>
        </div>

        <p className='max-w-2xl text-sm text-muted-foreground'>
          Read-only. <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>(po_id, po_line_no)</code> is a real
          foreign key into Purchase Order Lines — click a PO ID to view it in context on the Purchase Orders page.
        </p>
      </div>

      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <CardTitle>Material Documents</CardTitle>
          <CardDescription>
            Records are loaded from the backend endpoint <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>/api/goods_receipt</code>.
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
              getRowId={(r) => `${r.material_doc_no}-${r.material_doc_line}`}
              searchPlaceholder='Search by material, plant, or PO ID'
              searchableText={(r) => [r.material_no, r.plant, String(r.po_id), r.movement_type].join(' ')}
              emptyMessage='No goods receipts found.'
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
