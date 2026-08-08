'use client'

import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { postSSE } from '@/lib/sse-stream'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { Icons } from '@/components/ui/icons'

// ============================================================================
// Types — mirrors GET /api/orchestrator/status
// ============================================================================

export interface OrchestratorStatus {
  key: string
  workflowId: string | null
  name: string
  description: string
  batchNote: string | null
  isConfigured: boolean
  isActive: boolean
  latestRun: { id: string; status: string; createdAt: string; updatedAt: string } | null
  relatedCount: { label: string; count: number } | null
  schedule: { description: string | null; isPaused: boolean | null; timezone: string | null } | null
}

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

interface OrchestratorCardProps {
  status: OrchestratorStatus
  onRunComplete: () => void
}

// ============================================================================
// Component
// ============================================================================

export function OrchestratorCard({ status, onRunComplete }: OrchestratorCardProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [runError, setRunError] = useState<string | null>(null)
  const [result, setResult] = useState<OrchestratorResult | null>(null)

  const isBlocked = !status.isConfigured || status.isActive || isRunning

  const handleRun = useCallback(async () => {
    if (!status.isConfigured) return
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
      await postSSE(`/api/orchestrator/${status.key}/run/stream`, (event, data) => {
        switch (event) {
          case 'ping':
            return
          case 'error': {
            const payload = data as { error?: string; content?: string }
            setRunError(payload?.error || payload?.content || 'Run failed')
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
      setRunError(err instanceof Error ? err.message : 'Failed to run')
    } finally {
      setIsRunning(false)
      onRunComplete()
    }
  }, [status.key, status.isConfigured, onRunComplete])

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

  return (
    <Card className='relative overflow-hidden'>
      <CardWatermark opacity={2} scale={1} />
      <CardHeader>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <CardTitle>{status.name}</CardTitle>
            <CardDescription>{status.description}</CardDescription>
          </div>
          <Button
            variant='gradient'
            onClick={handleRun}
            disabled={isBlocked}
            className='flex-shrink-0'
            title={
              !status.isConfigured
                ? 'This operator is not configured yet'
                : status.isActive && !isRunning
                  ? 'A run is already in progress for this operator'
                  : undefined
            }
          >
            {isRunning ? (
              <>
                <Icons.loader className='mr-2 h-4 w-4 animate-spin' />
                Running...
              </>
            ) : !status.isConfigured ? (
              'Not Configured'
            ) : status.isActive ? (
              <>
                <Icons.loader className='mr-2 h-4 w-4 animate-spin' />
                Already Running
              </>
            ) : (
              <>
                <Icons.zap className='mr-2 h-4 w-4' strokeWidth={1.5} />
                Run
              </>
            )}
          </Button>
        </div>

        {status.relatedCount && (
          <div className='mt-3 flex items-baseline gap-2'>
            <span className='text-2xl font-bold text-brand-navy'>{status.relatedCount.count}</span>
            <span className='text-xs text-muted-foreground'>{status.relatedCount.label}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className='space-y-4'>
        {status.batchNote && (
          <div className='flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground'>
            <Icons.layers className='h-3.5 w-3.5 flex-shrink-0' />
            {status.batchNote}
          </div>
        )}

        {status.schedule && (
          <div className='flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground'>
            <Icons.clock className='h-3.5 w-3.5 flex-shrink-0' />
            <span>{status.schedule.description || 'Scheduled'}</span>
            {status.schedule.timezone && <span>· {status.schedule.timezone}</span>}
            <span
              className={cn(
                'ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                status.schedule.isPaused ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'
              )}
            >
              {status.schedule.isPaused ? 'Paused' : 'Active'}
            </span>
          </div>
        )}

        {(isRunning || logEntries.length > 0 || result || runError) && (
          <div className='space-y-3'>
            <div className='max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/20 p-4'>
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
                  <details className='rounded-xl border border-border bg-muted/20 p-3'>
                    <summary className='cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                      {lastStep?.stepName} output
                    </summary>
                    <pre className='mt-2 max-h-72 overflow-auto text-xs text-foreground'>{reportPreview}</pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
