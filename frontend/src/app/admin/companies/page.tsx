'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { apiClient } from '@/lib/api-client'
import { DataTable, DataTableColumn } from '@/components/common/DataTable'
import { Icons } from '@/components/ui/icons'

export interface CompanyRecord {
  company_code: string
  company_name: string
  country_code: string
  local_currency: string
  chart_of_accounts: number
  created_at?: string
}

const columns: DataTableColumn<CompanyRecord>[] = [
  { key: 'company_code', label: 'Company Code', sortValue: (r) => r.company_code, render: (r) => r.company_code },
  { key: 'company_name', label: 'Company Name', sortValue: (r) => r.company_name, render: (r) => r.company_name },
  { key: 'country_code', label: 'Country', sortValue: (r) => r.country_code, render: (r) => r.country_code },
  { key: 'local_currency', label: 'Local Currency', sortValue: (r) => r.local_currency, render: (r) => r.local_currency },
  {
    key: 'chart_of_accounts',
    label: 'Chart of Accounts',
    numeric: true,
    sortValue: (r) => r.chart_of_accounts,
    render: (r) => r.chart_of_accounts,
  },
  {
    key: 'created_at',
    label: 'Created',
    sortValue: (r) => r.created_at,
    render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'),
  },
]

export default function AdminCompaniesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
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

    fetchCompanies()
  }, [status, isAdmin, router])

  const fetchCompanies = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await apiClient.get<CompanyRecord[]>('/api/company')
      setCompanies(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load companies')
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
            <h1 className='text-display-4 font-bold text-brand-navy'>Company Codes</h1>
          </div>
          <div className='flex items-center gap-2'>
            <Icons.building className='h-6 w-6 text-brand-navy' />
            <span className='text-sm text-muted-foreground'>Gym operating entities and their reporting currency.</span>
          </div>
        </div>

        <p className='max-w-2xl text-sm text-muted-foreground'>
          Read-only reference data. Other modules refer to a company by <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>company_code</code> as free text — there is no database foreign key enforcing that link.
        </p>
      </div>

      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <CardTitle>Companies</CardTitle>
          <CardDescription>
            Every gym operating entity on file, kept in sync for invoicing and reporting.
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
              rows={companies}
              columns={columns}
              getRowId={(r) => r.company_code}
              searchPlaceholder='Search by company code or name'
              searchableText={(r) => [r.company_code, r.company_name, r.country_code, r.local_currency].join(' ')}
              emptyMessage='No companies found.'
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
