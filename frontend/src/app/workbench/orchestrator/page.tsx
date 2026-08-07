'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { Icons } from '@/components/ui/icons'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

// ============================================================================
// Types
// ============================================================================

interface LogEntry {
  id: string
  kind: 'thinking' | 'activity' | 'workflow'
  text: string
}

interface ActivityRunOutput {
  stepId: string
  stepName: string
  status: string
  outputs?: { output?: string; error?: string }
}

interface OrchestratorResult {
  success?: boolean
  message?: string
  workflowRun?: {
    status?: string
    activityRuns?: ActivityRunOutput[]
  }
}

// ============================================================================
// Streaming
// ============================================================================

/**
 * POST /api/orchestrator/run/stream streams SSE. Bypasses apiClient (which
 * always calls response.json()) for a raw fetch + manual line parse — same
 * approach as the AI Assistant's chat stream.
 */
async function streamOrchestratorRun(onEvent: (event: string, data: unknown) => void): Promise<void> {
  const session = await getSession()
  const headers = new Headers()
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`)
  if (session?.user?.email) headers.set('X-Approver-Email', session.user.email)

  const response = await fetch(`${API_URL}${BASE_PATH}/api/orchestrator/run/stream`, {
    method: 'POST',
    headers,
  })

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => response.statusText)
    throw new Error(errorText || 'Failed to start the orchestrator run')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = 'message'

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        let data: unknown = null
        try {
          data = JSON.parse(line.slice(6))
        } catch {
          continue
        }
        onEvent(currentEvent, data)
      }
    }
  }
}

// ============================================================================
// Animation
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

// ============================================================================
// Page
// ============================================================================

export default function OrchestratorPage() {
  const router = useRouter()

  const [isLoadingInitial, setIsLoadingInitial] = useState(true)
  const [parkedCount, setParkedCount] = useState<number | null>(null)
  const [initialError, setInitialError] = useState<string | null>(null)

  const [isRunning, setIsRunning] = useState(false)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [runError, setRunError] = useState<string | null>(null)
  const [result, setResult] = useState<OrchestratorResult | null>(null)

  const logEndRef = useRef<HTMLDivElement>(null)

  const loadParkedCount = useCallback(async () => {
    try {
      const data = await apiClient.get<{ count: number }>('/api/orchestrator/parked-count')
      setParkedCount(data.count)
      setInitialError(null)
    } catch (err) {
      setInitialError(err instanceof Error ? err.message : 'Unable to load parked invoice count')
    }
  }, [])

  useEffect(() => {
    loadParkedCount().finally(() => setIsLoadingInitial(false))
  }, [loadParkedCount])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logEntries])

  const handleRun = useCallback(async () => {
    setIsRunning(true)
    setRunError(null)
    setResult(null)
    setLogEntries([])

    let entryCount = 0
    const pushEntry = (kind: LogEntry['kind'], text: string) => {
      entryCount += 1
      setLogEntries((prev) => [...prev, { id: `${Date.now()}-${entryCount}`, kind, text }])
    }

    try {
      await streamOrchestratorRun((event, data) => {
        switch (event) {
          case 'ping':
            return
          case 'error': {
            const payload = data as { error?: string; content?: string }
            setRunError(payload?.error || payload?.content || 'Orchestrator run failed')
            return
          }
          case 'thinking': {
            const content = (data as { content?: string })?.content
            if (content) pushEntry('thinking', content)
            return
          }
          case 'activity-run': {
            const c = (data as { content?: { stepName?: string; status?: string } })?.content
            if (c?.stepName) pushEntry('activity', `${c.stepName} — ${c.status}`)
            return
          }
          case 'workflow-run': {
            const c = (data as { content?: { status?: string } })?.content
            if (c?.status) pushEntry('workflow', `Workflow ${c.status}`)
            return
          }
          case 'result':
            setResult(data as OrchestratorResult)
            return
          default:
            return
        }
      })
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Failed to run the orchestrator')
    } finally {
      setIsRunning(false)
      loadParkedCount()
    }
  }, [loadParkedCount])

  const activityRuns = result?.workflowRun?.activityRuns ?? []
  const lastStep = activityRuns[activityRuns.length - 1]
  let reportPreview: string | null = null
  if (lastStep?.outputs?.output) {
    try {
      reportPreview = JSON.stringify(JSON.parse(lastStep.outputs.output), null, 2)
    } catch {
      reportPreview = lastStep.outputs.output
    }
  }

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
      <motion.div variants={itemVariants} className='flex items-center justify-between'>
        <div>
          <p className='text-sm uppercase tracking-[0.2em] text-brand-cornflower'>Workbench</p>
          <h1 className='text-display-3 font-bold tracking-tight text-brand-navy lg:text-display-2'>
            Invoice Orchestrator
          </h1>
          <p className='mt-2 text-lg text-muted-foreground'>
            Master orchestrator — validates parked invoices and updates them to open or pending approval.
          </p>
        </div>
        <Button variant='outline' size='sm' onClick={() => router.push('/workbench')} className='gap-2'>
          <Icons.arrowLeft className='h-4 w-4' />
          Back to Workbench
        </Button>
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
              <p className='text-2xl font-bold text-brand-navy'>{parkedCount ?? '—'}</p>
              <p className='text-sm text-muted-foreground'>Parked Invoices</p>
            </div>
          </CardContent>
        </Card>

        <Card className='relative overflow-hidden'>
          <CardWatermark opacity={2} scale={0.8} />
          <CardContent className='relative z-10 flex h-full w-full items-center justify-between gap-4 py-6'>
            <div>
              <p className='text-sm font-medium text-foreground'>Run the orchestrator</p>
              <p className='mt-0.5 text-xs text-muted-foreground'>Processes up to 100 parked invoices per run</p>
            </div>
            <Button variant='gradient' onClick={handleRun} disabled={isRunning}>
              {isRunning ? (
                <>
                  <Icons.loader className='mr-2 h-4 w-4 animate-spin' />
                  Running...
                </>
              ) : (
                <>
                  <Icons.zap className='mr-2 h-4 w-4' strokeWidth={1.5} />
                  Run Orchestrator
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {(isRunning || logEntries.length > 0 || result || runError) && (
        <motion.div variants={itemVariants}>
          <Card className='relative overflow-hidden'>
            <CardWatermark opacity={2} scale={1} />
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Icons.activity className='h-5 w-5 text-brand-cornflower' />
                Run Progress
              </CardTitle>
              <CardDescription>Live steps streamed from the orchestrator workflow.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/20 p-4'>
                {logEntries.length === 0 && isRunning ? (
                  <p className='text-sm text-muted-foreground'>Starting...</p>
                ) : (
                  logEntries.map((entry) => (
                    <div key={entry.id} className='flex items-start gap-2 text-sm'>
                      <span
                        className={cn(
                          'mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full',
                          entry.kind === 'workflow'
                            ? 'bg-brand-navy'
                            : entry.kind === 'activity'
                              ? 'bg-brand-cornflower'
                              : 'bg-muted-foreground/40'
                        )}
                      />
                      <span className='text-muted-foreground'>{entry.text}</span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>

              {runError && (
                <div className='flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
                  <Icons.alertCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
                  {runError}
                </div>
              )}

              {result && (
                <div className='space-y-3'>
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-3 text-sm',
                      result.success
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                    )}
                  >
                    {result.success ? (
                      <Icons.checkCircle className='h-4 w-4 flex-shrink-0' />
                    ) : (
                      <Icons.alertCircle className='h-4 w-4 flex-shrink-0' />
                    )}
                    {result.message || (result.success ? 'Run completed' : 'Run failed')}
                    {activityRuns.length > 0 && (
                      <span className='ml-auto text-xs text-muted-foreground'>
                        {activityRuns.length} step{activityRuns.length === 1 ? '' : 's'} completed
                      </span>
                    )}
                  </div>

                  {reportPreview && (
                    <div>
                      <p className='mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                        Consolidated Report ({lastStep?.stepName})
                      </p>
                      <pre className='max-h-96 overflow-auto rounded-xl border border-border bg-muted/20 p-4 text-xs text-foreground'>
                        {reportPreview}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}
