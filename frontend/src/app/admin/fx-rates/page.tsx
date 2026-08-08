'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { apiClient } from '@/lib/api-client'
import { DataTable, DataTableColumn } from '@/components/common/DataTable'
import { Icons } from '@/components/ui/icons'

export interface FxRateRecord {
  rate_date: string
  from_currency: string
  to_currency: string
  exchange_rate: number
  from_factor: number
  to_factor: number
}

const columns: DataTableColumn<FxRateRecord>[] = [
  {
    key: 'rate_date',
    label: 'Rate Date',
    sortValue: (r) => r.rate_date,
    render: (r) => new Date(r.rate_date).toLocaleDateString(),
  },
  { key: 'from_currency', label: 'From', sortValue: (r) => r.from_currency, render: (r) => r.from_currency },
  { key: 'to_currency', label: 'To', sortValue: (r) => r.to_currency, render: (r) => r.to_currency },
  {
    key: 'exchange_rate',
    label: 'Exchange Rate',
    numeric: true,
    sortValue: (r) => r.exchange_rate,
    render: (r) => r.exchange_rate.toLocaleString('en-US', { maximumFractionDigits: 6 }),
  },
  { key: 'from_factor', label: 'From Factor', numeric: true, sortValue: (r) => r.from_factor, render: (r) => r.from_factor },
  { key: 'to_factor', label: 'To Factor', numeric: true, sortValue: (r) => r.to_factor, render: (r) => r.to_factor },
]

export default function AdminFxRatesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [rows, setRows] = useState<FxRateRecord[]>([])
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
      const data = await apiClient.get<FxRateRecord[]>('/api/fx_rate')
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load FX rates')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-sm uppercase tracking-[0.2em] text-brand-cornflower'>Master Data</p>
            <h1 className='text-display-4 font-bold text-brand-navy'>FX Rates</h1>
          </div>
          <div className='flex items-center gap-2'>
            <Icons.trendingUp className='h-6 w-6 text-brand-navy' />
            <span className='text-sm text-muted-foreground'>Daily currency conversion rates for cross-border SEA equipment purchases.</span>
          </div>
        </div>

        <p className='max-w-2xl text-sm text-muted-foreground'>
          Read-only. Currency codes are free text — there is no currency master table and no foreign key from invoices,
          purchase orders, or vendors into this table.
        </p>
      </div>

      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <CardTitle>Rates</CardTitle>
          <CardDescription>
            Daily exchange rates used to convert vendor invoices into your reporting currency.
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
              getRowId={(r) => `${r.rate_date}-${r.from_currency}-${r.to_currency}`}
              searchPlaceholder='Search by currency pair'
              searchableText={(r) => [r.from_currency, r.to_currency].join(' ')}
              emptyMessage='No FX rates found.'
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
