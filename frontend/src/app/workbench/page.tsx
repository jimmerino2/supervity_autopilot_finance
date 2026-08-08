'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { apiClient } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { Icons } from '@/components/ui/icons'
import { OrchestratorCard, type OrchestratorStatus } from '@/components/workbench/OrchestratorCard'
import { UserFormsList } from '@/components/workbench/UserFormsList'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

interface InvoiceCounts {
  parked: number
  pendingApproval: number
}

export default function WorkbenchPage() {
  const [isLoadingInitial, setIsLoadingInitial] = useState(true)
  const [invoiceCounts, setInvoiceCounts] = useState<InvoiceCounts | null>(null)
  const [orchestrators, setOrchestrators] = useState<OrchestratorStatus[]>([])
  const [initialError, setInitialError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const [countsData, statusData] = await Promise.all([
        apiClient.get<InvoiceCounts>('/api/orchestrator/invoice-counts'),
        apiClient.get<{ orchestrators: OrchestratorStatus[] }>('/api/orchestrator/status'),
      ])
      setInvoiceCounts(countsData)
      setOrchestrators(statusData.orchestrators)
      setInitialError(null)
    } catch (err) {
      setInitialError(err instanceof Error ? err.message : 'Unable to load orchestrator status')
    }
  }, [])

  useEffect(() => {
    loadStatus().finally(() => setIsLoadingInitial(false))
  }, [loadStatus])

  // Per spec: while the initial state is loading, show nothing but a loading message.
  if (isLoadingInitial) {
    return (
      <div className='flex h-[60vh] items-center justify-center'>
        <div className='flex flex-col items-center gap-3'>
          <Icons.loader className='h-8 w-8 animate-spin text-brand-cornflower' />
          <p className='text-sm text-muted-foreground'>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div className='space-y-6' variants={containerVariants} initial='hidden' animate='visible'>
      <motion.div variants={itemVariants}>
        <h1 className='text-display-3 font-bold tracking-tight text-brand-navy lg:text-display-2'>
          Invoice Orchestrators
        </h1>
        <p className='mt-2 text-lg text-muted-foreground'>
          Master orchestrators for the invoice pipeline — scanning inboxes and validating parked invoices.
        </p>
      </motion.div>

      {initialError && (
        <motion.div
          variants={itemVariants}
          className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'
        >
          {initialError}
        </motion.div>
      )}

      <motion.div variants={itemVariants} className='grid gap-4 sm:grid-cols-2'>
        <Card className='relative overflow-hidden'>
          <CardWatermark opacity={2} scale={0.8} />
          <CardContent className='relative z-10 flex items-center gap-4 py-6'>
            <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100'>
              <Icons.fileText className='h-6 w-6 text-amber-600' strokeWidth={1.5} />
            </div>
            <div>
              <p className='text-2xl font-bold text-brand-navy'>{invoiceCounts?.parked ?? '—'}</p>
              <p className='text-sm text-muted-foreground'>Parked Invoices</p>
            </div>
          </CardContent>
        </Card>

        <Card className='relative overflow-hidden'>
          <CardWatermark opacity={2} scale={0.8} />
          <CardContent className='relative z-10 flex items-center gap-4 py-6'>
            <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100'>
              <Icons.clock className='h-6 w-6 text-blue-600' strokeWidth={1.5} />
            </div>
            <div>
              <p className='text-2xl font-bold text-brand-navy'>{invoiceCounts?.pendingApproval ?? '—'}</p>
              <p className='text-sm text-muted-foreground'>Pending Approval</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants} className='grid gap-6 lg:grid-cols-2'>
        {orchestrators.map((orch) => (
          <OrchestratorCard key={orch.key} status={orch} onRunComplete={loadStatus} />
        ))}
      </motion.div>

      <motion.div variants={itemVariants}>
        <UserFormsList />
      </motion.div>
    </motion.div>
  )
}
