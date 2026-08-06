'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { cn } from '@/lib/utils'

const REFRESH_INTERVAL_MS = 30_000
const RECENT_RUNS_LIMIT = 10
type RunStatus = 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting'

interface WorkflowRunSummary {
  id: string
  workflowId: string
  workflowName: string | null
  status: RunStatus | string
  createdAt: string
  updatedAt: string
}

interface WorkflowRunsListResponse {
  workflowRuns: WorkflowRunSummary[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

interface WorkflowDashboardCounts {
  scheduled: number
  running: number
  completed: number
  failed: number
  cancelled: number
  waiting: number
}

interface WorkflowHealthRow {
  workflowId: string
  workflowName: string
  counts: WorkflowDashboardCounts | null
}

interface ActivityRun {
  id: string
  stepId: string
  stepName: string
  stepDescription?: string
  status: string
  outputs?: { output?: string; error?: string }
  startedAt?: string | null
  completedAt?: string | null
  errorDetails?: unknown
}

interface WorkflowRunDetail {
  id: string
  workflowId: string
  workflowName: string
  workflowDescription?: string
  status: string
  createdAt: string
  updatedAt: string
  startedAt?: string | null
  completedAt?: string | null
  errorDetails?: unknown
}

interface WorkflowRunDetailResponse {
  workflowRun: WorkflowRunDetail
  activityRuns: ActivityRun[]
}

export interface DailyRunActivity {
  name: string
  runs: number
  completed: number
  failed: number
}

export interface RunHealthStats {
  activeRuns: number
  successRate: number | null
  // Cumulative total across resolved workflows' dashboard counts — accurate
  // regardless of how many rows the Recent Runs list happens to fetch.
  totalRuns: number
  dailyActivity: DailyRunActivity[]
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  running: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-slate-100 text-slate-700',
  waiting: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700'
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', tone)}>{status}</span>
}

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (Number.isNaN(ms) || ms < 0) return '—'
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remSeconds = Math.round(seconds % 60)
  return `${minutes}m ${remSeconds}s`
}

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSec = Math.round(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildDailyActivity(runs: WorkflowRunSummary[], days = 7): DailyRunActivity[] {
  const buckets = new Map<string, DailyRunActivity>()
  const today = new Date()

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    buckets.set(key, { name: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }), runs: 0, completed: 0, failed: 0 })
  }

  for (const run of runs) {
    const key = dayKey(run.createdAt)
    const bucket = buckets.get(key)
    if (!bucket) continue // outside the visible window
    bucket.runs += 1
    if (run.status === 'completed') bucket.completed += 1
    if (run.status === 'failed') bucket.failed += 1
  }

  return Array.from(buckets.values())
}

function emptyCounts(): WorkflowDashboardCounts {
  return { scheduled: 0, running: 0, completed: 0, failed: 0, cancelled: 0, waiting: 0 }
}

function workflowHealthLabel(counts: WorkflowDashboardCounts | null): { label: string; tone: string } {
  if (!counts) return { label: 'Unavailable', tone: 'bg-slate-100 text-slate-500' }
  const finished = counts.completed + counts.failed + counts.cancelled
  if (counts.failed === 0) return { label: 'Healthy', tone: 'bg-emerald-100 text-emerald-700' }
  const failRate = finished > 0 ? counts.failed / finished : 0
  if (failRate >= 0.25) return { label: 'Failing', tone: 'bg-red-100 text-red-700' }
  return { label: 'Attention', tone: 'bg-amber-100 text-amber-700' }
}

function countCell(value: number | undefined) {
  return value ?? '—'
}

const healthColumns: DataTableColumn<WorkflowHealthRow>[] = [
  {
    key: 'workflowName',
    label: 'Workflow',
    sortValue: (r) => r.workflowName,
    render: (r) => <span className='font-medium text-brand-navy'>{r.workflowName}</span>,
  },
  {
    key: 'health',
    label: 'Health',
    sortValue: (r) => workflowHealthLabel(r.counts).label,
    render: (r) => {
      const { label, tone } = workflowHealthLabel(r.counts)
      return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', tone)}>{label}</span>
    },
  },
  {
    key: 'running',
    label: 'Running',
    numeric: true,
    sortValue: (r) => r.counts?.running ?? -1,
    render: (r) => countCell(r.counts?.running),
  },
  {
    key: 'scheduled',
    label: 'Scheduled',
    numeric: true,
    sortValue: (r) => r.counts?.scheduled ?? -1,
    render: (r) => countCell(r.counts?.scheduled),
  },
  {
    key: 'waiting',
    label: 'Waiting',
    numeric: true,
    sortValue: (r) => r.counts?.waiting ?? -1,
    render: (r) => countCell(r.counts?.waiting),
  },
  {
    key: 'completed',
    label: 'Completed',
    numeric: true,
    sortValue: (r) => r.counts?.completed ?? -1,
    render: (r) => countCell(r.counts?.completed),
  },
  {
    key: 'failed',
    label: 'Failed',
    numeric: true,
    sortValue: (r) => r.counts?.failed ?? -1,
    render: (r) => countCell(r.counts?.failed),
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    numeric: true,
    sortValue: (r) => r.counts?.cancelled ?? -1,
    render: (r) => countCell(r.counts?.cancelled),
  },
]

interface WorkflowRunHealthProps {
  onStatsChange?: (stats: RunHealthStats) => void
}

export function WorkflowRunHealth({ onStatsChange }: WorkflowRunHealthProps) {
  const [runs, setRuns] = useState<WorkflowRunSummary[]>([])
  const [healthRows, setHealthRows] = useState<WorkflowHealthRow[]>([])
  // Workflows Supervity actually resolved a dashboard for — only these are safe
  // to attempt a run-detail lookup on, since an unresolvable workflow 404s there too.
  const [resolvedWorkflowIds, setResolvedWorkflowIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<WorkflowRunDetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const onStatsChangeRef = useRef(onStatsChange)
  onStatsChangeRef.current = onStatsChange

  const load = useCallback(async () => {
    setError(null)
    try {
      // Only the latest RECENT_RUNS_LIMIT runs — fetching hundreds of records just to
      // populate this table made every refresh cycle noticeably slow.
      const first = await apiClient.get<WorkflowRunsListResponse>(
        `/api/supervity/workflow-runs?limit=${RECENT_RUNS_LIMIT}&page=1`
      )
      const allRuns = first.workflowRuns

      setRuns(allRuns)

      // Build the distinct workflow id -> name map (prefer any run that carries a name).
      const nameById = new Map<string, string>()
      for (const run of allRuns) {
        if (run.workflowName) nameById.set(run.workflowId, run.workflowName)
      }

      const workflowIds = Array.from(nameById.keys())
      const dashboardResults = await Promise.allSettled(
        workflowIds.map((workflowId) =>
          apiClient.get<{ counts: WorkflowDashboardCounts }>(`/api/supervity/workflow-runs/dashboard/${workflowId}`)
        )
      )

      // Every workflow observed in recent runs gets a row — even if its dashboard
      // counts couldn't be fetched (e.g. an archived/older workflow on Supervity's
      // side 404s) — so the table never silently hides a known workflow.
      const rows: WorkflowHealthRow[] = []
      const resolvedIds = new Set<string>()
      let totalCompleted = 0
      let totalFailed = 0
      let totalCancelled = 0
      let totalActive = 0

      workflowIds.forEach((workflowId, index) => {
        const result = dashboardResults[index]
        const workflowName = nameById.get(workflowId) ?? workflowId

        if (result.status !== 'fulfilled') {
          rows.push({ workflowId, workflowName, counts: null })
          return
        }

        resolvedIds.add(workflowId)
        const safeCounts = { ...emptyCounts(), ...result.value.counts }
        rows.push({ workflowId, workflowName, counts: safeCounts })
        totalCompleted += safeCounts.completed
        totalFailed += safeCounts.failed
        totalCancelled += safeCounts.cancelled
        totalActive += safeCounts.running + safeCounts.scheduled + safeCounts.waiting
      })

      // Unavailable rows sort to the bottom; among available rows, surface the
      // most failures and the most currently-running first.
      rows.sort((a, b) => {
        if (!a.counts && !b.counts) return 0
        if (!a.counts) return 1
        if (!b.counts) return -1
        return b.counts.failed - a.counts.failed || b.counts.running - a.counts.running
      })
      setHealthRows(rows)
      setResolvedWorkflowIds(resolvedIds)

      const finishedTotal = totalCompleted + totalFailed + totalCancelled
      const successRate = finishedTotal > 0 ? Math.round((totalCompleted / finishedTotal) * 100) : null
      const totalRuns = totalCompleted + totalFailed + totalCancelled + totalActive
      const dailyActivity = buildDailyActivity(allRuns)

      onStatsChangeRef.current?.({ activeRuns: totalActive, successRate, totalRuns, dailyActivity })
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load workflow run health')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load])

  const openRunDetail = async (run: WorkflowRunSummary) => {
    // Guard against the case where Supervity couldn't resolve this run's
    // workflow via the dashboard endpoint — the run-detail lookup 404s too.
    if (!resolvedWorkflowIds.has(run.workflowId)) return

    const runId = run.id
    setSelectedRunId(runId)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetail(null)

    try {
      const data = await apiClient.get<WorkflowRunDetailResponse>(`/api/supervity/workflow-runs/${runId}`)
      setDetail(data)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unable to load run detail')
    } finally {
      setDetailLoading(false)
    }
  }

  const recentRunsColumns: DataTableColumn<WorkflowRunSummary>[] = [
    {
      key: 'workflowName',
      label: 'Workflow',
      sortValue: (r) => r.workflowName ?? r.workflowId,
      render: (r) => r.workflowName ?? <span className='italic text-muted-foreground'>Unknown workflow</span>,
    },
    { key: 'status', label: 'Status', sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'createdAt',
      label: 'Started',
      sortValue: (r) => r.createdAt,
      render: (r) => formatRelativeTime(r.createdAt),
    },
    {
      key: 'duration',
      label: 'Duration',
      sortValue: (r) => new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime(),
      render: (r) => (r.status === 'completed' || r.status === 'failed' ? formatDuration(r.createdAt, r.updatedAt) : '—'),
    },
  ]

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <p className='text-sm uppercase tracking-[0.2em] text-brand-cornflower'>Agent Orchestration</p>
          <h2 className='text-display-4 font-bold text-brand-navy'>Workflow Run Health</h2>
        </div>
        <div className='flex items-center gap-3 text-sm text-muted-foreground'>
          {lastUpdated && <span>Updated {formatRelativeTime(lastUpdated.toISOString())} · auto-refreshes every 30s</span>}
          <Button variant='outline' size='sm' onClick={load} disabled={isLoading} className='gap-2'>
            <Icons.refresh className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {error && <div className='rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700'>{error}</div>}

      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <CardTitle>Agent Health by Workflow</CardTitle>
          <CardDescription>
            Status counts from <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>/api/supervity/workflow-runs/dashboard/{'{workflow_id}'}</code>,
            one call per workflow observed in recent runs. Workflows Supervity can no longer return counts for (e.g. archived
            versions) are shown as &ldquo;Unavailable&rdquo; rather than hidden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && healthRows.length === 0 ? (
            <div className='flex h-40 items-center justify-center'>
              <div className='h-10 w-10 animate-spin rounded-full border-4 border-brand-navy border-t-transparent' />
            </div>
          ) : (
            <DataTable
              rows={healthRows}
              columns={healthColumns}
              getRowId={(r) => r.workflowId}
              searchPlaceholder='Search by workflow name'
              searchableText={(r) => r.workflowName}
              emptyMessage='No workflow runs found yet.'
            />
          )}
        </CardContent>
      </Card>

      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
          <CardDescription>
            Latest {RECENT_RUNS_LIMIT} runs from{' '}
            <code className='rounded-md bg-slate-100 px-1 py-0.5 text-xs'>/api/supervity/workflow-runs</code>. Select a run to
            inspect its step-by-step activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && runs.length === 0 ? (
            <div className='flex h-40 items-center justify-center'>
              <div className='h-10 w-10 animate-spin rounded-full border-4 border-brand-navy border-t-transparent' />
            </div>
          ) : (
            <DataTable
              rows={runs}
              columns={recentRunsColumns}
              getRowId={(r) => r.id}
              searchPlaceholder='Search by workflow name or status'
              searchableText={(r) => [r.workflowName ?? '', r.status].join(' ')}
              onView={openRunDetail}
              canView={(r) => resolvedWorkflowIds.has(r.workflowId)}
              viewDisabledTooltip="This run's workflow is no longer resolvable on Supervity, so details aren't available."
              emptyMessage='No runs found.'
              defaultSortKey='createdAt'
              defaultSortDirection='desc'
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className='sm:max-w-3xl'>
          <DialogHeader>
            <DialogTitle>Run Detail</DialogTitle>
            <DialogDescription>{selectedRunId}</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className='flex h-40 items-center justify-center'>
              <div className='h-8 w-8 animate-spin rounded-full border-4 border-brand-navy border-t-transparent' />
            </div>
          ) : detailError ? (
            <div className='rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700'>{detailError}</div>
          ) : detail ? (
            <div className='max-h-[70vh] space-y-6 overflow-y-auto py-2'>
              <div className='grid gap-4 sm:grid-cols-3'>
                <Field label='Workflow' value={detail.workflowRun.workflowName} />
                <Field label='Status' value={<StatusBadge status={detail.workflowRun.status} />} />
                <Field
                  label='Duration'
                  value={formatDuration(detail.workflowRun.startedAt, detail.workflowRun.completedAt)}
                />
                <Field
                  label='Started'
                  value={detail.workflowRun.startedAt ? new Date(detail.workflowRun.startedAt).toLocaleString() : '—'}
                />
                <Field
                  label='Completed'
                  value={detail.workflowRun.completedAt ? new Date(detail.workflowRun.completedAt).toLocaleString() : '—'}
                />
                <Field label='Run ID' value={<span className='font-mono text-xs'>{detail.workflowRun.id}</span>} />
              </div>

              {detail.workflowRun.errorDetails != null && (
                <div className='rounded-2xl border border-red-200 bg-red-50 p-4'>
                  <Label className='text-xs uppercase tracking-[0.2em] text-red-700'>Error Details</Label>
                  <pre className='mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-red-800'>
                    {typeof detail.workflowRun.errorDetails === 'string'
                      ? detail.workflowRun.errorDetails
                      : JSON.stringify(detail.workflowRun.errorDetails, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <Label className='text-xs uppercase tracking-[0.2em] text-slate-500'>
                  Activity Steps ({detail.activityRuns.length})
                </Label>
                <div className='mt-2 overflow-x-auto rounded-2xl border border-border'>
                  <table className='min-w-full divide-y divide-border text-sm'>
                    <thead className='bg-slate-50'>
                      <tr>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Step</th>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Status</th>
                        <th className='px-3 py-2 text-right font-medium text-slate-600'>Duration</th>
                        <th className='px-3 py-2 text-left font-medium text-slate-600'>Output / Error</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-border bg-white'>
                      {detail.activityRuns.length > 0 ? (
                        detail.activityRuns.map((activity) => (
                          <tr key={activity.id}>
                            <td className='px-3 py-2'>{activity.stepName}</td>
                            <td className='px-3 py-2'>
                              <StatusBadge status={activity.status} />
                            </td>
                            <td className='px-3 py-2 text-right'>
                              {formatDuration(activity.startedAt, activity.completedAt)}
                            </td>
                            <td className='max-w-xs truncate px-3 py-2 font-mono text-xs text-muted-foreground'>
                              {activity.outputs?.error || activity.outputs?.output || '—'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className='px-3 py-4 text-center text-muted-foreground'>
                            No activity steps recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant='outline' onClick={() => setDetailOpen(false)}>
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
