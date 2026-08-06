'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { Icons } from '@/components/ui/icons'
import { ActivityChart } from '@/components/ActivityChart'
import { StatCard } from '@/components/dashboard/StatCard'
import { RunHealthStats, WorkflowRunHealth } from '@/components/dashboard/WorkflowRunHealth'

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}

// Hero Section
function HeroSection({ userName }: { userName?: string }) {
  const firstName = userName?.split(' ')[0] || 'there'

  return (
    <motion.div
      className='col-span-12 py-2'
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <h1 className='text-display-3 font-bold tracking-tight text-brand-navy lg:text-display-2'>
        Where Intelligence <br className='hidden sm:block' />
        <span className='text-gradient'>Meets Human.</span>
      </h1>
      <p className='mt-4 text-lg font-light text-muted-foreground'>
        Welcome back, {firstName}. Your AI Command Center is ready.
      </p>
    </motion.div>
  )
}

// Diagnostics Card
function DiagnosticsCard() {
  const [apiResponse, setApiResponse] = useState<string>('')
  const [adminResponse, setAdminResponse] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const callApi = async (
    endpoint: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    setIsLoading(true)
    setter('Loading...')
    try {
      const data = await apiClient.get(endpoint)
      setter(JSON.stringify(data, null, 2))
    } catch (error) {
      setter(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className='relative col-span-12 h-full overflow-hidden'>
      <CardWatermark opacity={3} scale={1.1} />
      <CardHeader className='relative z-10'>
        <CardTitle className='flex items-center gap-2'>
          <Icons.activity
            className='h-5 w-5 text-brand-cornflower'
            strokeWidth={1.5}
          />
          System Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className='relative z-10 space-y-6'>
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-foreground'>
                Standard Authorization
              </p>
              <p className='mt-0.5 font-mono text-xs text-muted-foreground'>
                /api/test
              </p>
            </div>
          </div>
          <Button
            onClick={() => callApi('/api/test', setApiResponse)}
            disabled={isLoading}
            variant='outline'
            className='w-full'
          >
            {isLoading ? 'Running...' : 'Run Diagnostics'}
          </Button>
          {apiResponse && (
            <div className='rounded-xl border border-border/50 bg-muted/30 p-4'>
              <pre className='overflow-x-auto font-mono text-xs text-muted-foreground'>
                <code>{apiResponse}</code>
              </pre>
            </div>
          )}
        </div>

        <div className='h-px bg-border/50' />

        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm font-medium text-foreground'>
                Admin Verification
              </p>
              <p className='mt-0.5 font-mono text-xs text-muted-foreground'>
                /api/admin/dashboard
              </p>
            </div>
          </div>
          <Button
            onClick={() => callApi('/api/admin/dashboard', setAdminResponse)}
            disabled={isLoading}
            variant='gradient'
            className='w-full'
          >
            {isLoading ? 'Verifying...' : 'Verify Admin Access'}
            <Icons.arrowRight className='ml-2 h-4 w-4' />
          </Button>
          {adminResponse && (
            <div className='rounded-xl border border-border/50 bg-muted/30 p-4'>
              <pre className='overflow-x-auto font-mono text-xs text-muted-foreground'>
                <code>{adminResponse}</code>
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Main Dashboard — no auth required, renders directly
export default function HomePage() {
  const [paidInvoiceCount, setPaidInvoiceCount] = useState(0)
  const [invoiceTrend, setInvoiceTrend] = useState({ value: 'Loading...', positive: true })
  const [runHealthStats, setRunHealthStats] = useState<RunHealthStats>({
    activeRuns: 0,
    successRate: null,
    totalRuns: 0,
    dailyActivity: [],
  })
  const [runHealthLoaded, setRunHealthLoaded] = useState(false)

  const currentMonthLabel = new Date().toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
  })

  useEffect(() => {
    const loadPaidInvoiceMetrics = async () => {
      try {
        const invoices = await apiClient.get<Array<{ status?: string; posting_date?: string; document_date?: string }>>('/api/invoice')

        const getMonthKey = (value?: string) => {
          if (!value) return null
          const normalizedValue = value.includes('T') || value.includes(' ') ? value.replace(' ', 'T') : value
          const date = new Date(normalizedValue)
          if (Number.isNaN(date.getTime())) return null
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        }

        const now = new Date()
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const previousMonthKey = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`

        const currentMonthCount = invoices.filter((invoice) => {
          const invoiceMonth = getMonthKey(invoice.posting_date || invoice.document_date)
          return invoice.status === 'paid' && invoiceMonth === currentMonthKey
        }).length

        const previousMonthCount = invoices.filter((invoice) => {
          const invoiceMonth = getMonthKey(invoice.posting_date || invoice.document_date)
          return invoice.status === 'paid' && invoiceMonth === previousMonthKey
        }).length

        const delta = currentMonthCount - previousMonthCount
        setPaidInvoiceCount(currentMonthCount)
        setInvoiceTrend({
          value: delta === 0 ? 'No change vs last month' : `${delta > 0 ? '+' : ''}${delta} vs last month`,
          positive: delta >= 0,
        })
      } catch (error) {
        console.error('Failed to load invoice metrics', error)
        setPaidInvoiceCount(0)
        setInvoiceTrend({ value: 'Unable to load trend', positive: false })
      }
    }

    loadPaidInvoiceMetrics()
  }, [])

  return (
    <motion.div
      className='space-y-6'
      variants={containerVariants}
      initial='hidden'
      animate='visible'
    >
      {/* Hero Section */}
      <HeroSection userName='Developer' />

      {/* Stats Grid - Bento style */}
      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <StatCard
          title={`Successful Invoices (${currentMonthLabel})`}
          value={paidInvoiceCount}
          icon={Icons.users}
          trend={{ value: invoiceTrend.value, positive: invoiceTrend.positive }}
          colorClass='bg-brand-navy'
          delay={0.1}
        />
        <StatCard
          title='Active Agent Runs'
          value={runHealthStats.activeRuns}
          icon={Icons.activity}
          colorClass='bg-brand-cornflower'
          delay={0.2}
        />
        <StatCard
          title='Agent Run Success Rate'
          value={runHealthStats.successRate ?? 0}
          suffix='%'
          icon={Icons.checkCircle}
          colorClass='bg-brand-purple'
          delay={0.3}
        />
        <StatCard
          title='Total Tracked Runs'
          value={runHealthStats.totalRuns}
          icon={Icons.zap}
          colorClass='bg-gradient-to-br from-brand-navy to-brand-purple'
          delay={0.4}
        />
      </div>

      {/* Activity Chart - Full Width */}
      <motion.div variants={itemVariants}>
        <ActivityChart className='col-span-12' data={runHealthStats.dailyActivity} isLoading={!runHealthLoaded} />
      </motion.div>

      {/* Agent Run Health - Full Width */}
      <motion.div variants={itemVariants}>
        <WorkflowRunHealth
          onStatsChange={(stats) => {
            setRunHealthStats(stats)
            setRunHealthLoaded(true)
          }}
        />
      </motion.div>

      {/* System Diagnostics */}
      {/*
      <motion.div
        className='grid gap-6 lg:grid-cols-12'
        variants={itemVariants}
      >
        <DiagnosticsCard />
      </motion.div>
      */}
    </motion.div>
  )
}
