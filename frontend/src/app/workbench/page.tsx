'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { apiClient } from '@/lib/api-client'
import { Icons } from '@/components/ui/icons'
import { OrchestratorCard, type OrchestratorStatus } from '@/components/workbench/OrchestratorCard'
import { InvoiceReviewQueue } from '@/components/workbench/InvoiceReviewQueue'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function WorkbenchPage() {
  const [isLoadingInitial, setIsLoadingInitial] = useState(true)
  const [orchestrators, setOrchestrators] = useState<OrchestratorStatus[]>([])
  const [initialError, setInitialError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const statusData = await apiClient.get<{ orchestrators: OrchestratorStatus[] }>('/api/orchestrator/status')
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
          Master orchestrators for gym equipment, maintenance, and subscription invoices — from scanning inboxes to issuing vendor payments.
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

      <motion.div variants={itemVariants} className='grid gap-6 lg:grid-cols-3'>
        {orchestrators
          // "Manual Invoice Validation" now backs the per-invoice Review
          // action below instead of a bulk Run button — it's still used
          // elsewhere (its original master workflow keeps running on its own
          // schedule), just not surfaced as a card here.
          .filter((orch) => orch.key !== 'manual-validation')
          .map((orch) => (
            <OrchestratorCard key={orch.key} status={orch} onRunComplete={loadStatus} />
          ))}
      </motion.div>

      <motion.div variants={itemVariants}>
        <InvoiceReviewQueue />
      </motion.div>
    </motion.div>
  )
}
