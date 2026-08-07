'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { Icons } from '@/components/ui/icons'
import { DataTable, DataTableColumn } from '@/components/common/DataTable'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ============================================================================
// Types — mirrors docs.supervity.ai/api-docs/user-forms, proxied via
// /api/supervity/user-forms
// ============================================================================

type FormStatus = 'pending' | 'approved' | 'rejected'

interface UserForm {
  id: string
  workflowId: string
  workflowName: string
  workflowDescription: string | null
  workflowRunId: string
  activityRunId: string
  workflowStepName: string
  workflowStepDescription: string | null
  status: FormStatus
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

interface UserFormsListResponse {
  forms: UserForm[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

const STATUS_STYLES: Record<FormStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

function StatusBadge({ status }: { status: FormStatus }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', STATUS_STYLES[status])}>
      {status}
    </span>
  )
}

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSec = Math.round(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.round(diffHr / 24)}d ago`
}

/** Reads reviewer-filled values out of the sandboxed form iframe, if any exist. */
function extractFormFields(iframe: HTMLIFrameElement | null): Record<string, string> {
  const formEl = iframe?.contentDocument?.querySelector('form')
  if (!formEl) return {}
  const fields: Record<string, string> = {}
  new FormData(formEl).forEach((value, key) => {
    if (typeof value === 'string') fields[key] = value
  })
  return fields
}

const TABS: { id: 'all' | FormStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function UserFormsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'all' | FormStatus>('pending')
  const [forms, setForms] = useState<UserForm[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<UserForm | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [formHtml, setFormHtml] = useState<string | null>(null)
  const [htmlLoading, setHtmlLoading] = useState(false)
  const [htmlError, setHtmlError] = useState<string | null>(null)
  const [decisionLoading, setDecisionLoading] = useState<'approve' | 'reject' | null>(null)
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const query = tab === 'all' ? '' : `&status=${tab}`
      const data = await apiClient.get<UserFormsListResponse>(
        `/api/supervity/user-forms?page=1&limit=100&sortBy=createdAt&sortOrder=desc${query}`
      )
      setForms(data.forms)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load forms')
    } finally {
      setIsLoading(false)
    }
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

  const openForm = useCallback(async (form: UserForm) => {
    setSelected(form)
    setDetailOpen(true)
    setFormHtml(null)
    setHtmlError(null)
    setDecisionError(null)
    setHtmlLoading(true)
    try {
      const data = await apiClient.get<{ html: string }>(`/api/supervity/user-forms/${form.id}`)
      setFormHtml(data.html)
    } catch (err) {
      setHtmlError(err instanceof Error ? err.message : 'Unable to load form content')
    } finally {
      setHtmlLoading(false)
    }
  }, [])

  const decide = useCallback(
    async (status: 'approve' | 'reject') => {
      if (!selected) return
      setDecisionLoading(status)
      setDecisionError(null)
      try {
        const fields = extractFormFields(iframeRef.current)
        await apiClient.post(`/api/supervity/user-forms/${selected.activityRunId}/${status}`, { fields })
        setDetailOpen(false)
        await load()
      } catch (err) {
        setDecisionError(err instanceof Error ? err.message : `Failed to ${status} form`)
      } finally {
        setDecisionLoading(null)
      }
    },
    [selected, load]
  )

  const columns: DataTableColumn<UserForm>[] = [
    {
      key: 'workflowName',
      label: 'Workflow',
      sortValue: (r) => r.workflowName,
      render: (r) => <span className='font-medium text-brand-navy'>{r.workflowName}</span>,
    },
    {
      key: 'workflowStepName',
      label: 'Step',
      sortValue: (r) => r.workflowStepName,
    },
    {
      key: 'status',
      label: 'Status',
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'createdAt',
      label: 'Requested',
      sortValue: (r) => r.createdAt,
      render: (r) => formatRelativeTime(r.createdAt),
    },
    {
      key: 'reviewedBy',
      label: 'Reviewed By',
      sortValue: (r) => r.reviewedBy ?? '',
      render: (r) => r.reviewedBy || '—',
    },
  ]

  return (
    <motion.div className='space-y-6' variants={containerVariants} initial='hidden' animate='visible'>
      <motion.div variants={itemVariants} className='flex items-center justify-between'>
        <div>
          <p className='text-sm uppercase tracking-[0.2em] text-brand-cornflower'>Workbench</p>
          <h1 className='text-display-3 font-bold tracking-tight text-brand-navy lg:text-display-2'>
            User Forms
          </h1>
          <p className='mt-2 text-lg text-muted-foreground'>
            Review and action human-input steps paused on Supervity workflows.
          </p>
        </div>
        <Button variant='outline' size='sm' onClick={() => router.push('/workbench')} className='gap-2'>
          <Icons.arrowLeft className='h-4 w-4' />
          Back to Workbench
        </Button>
      </motion.div>

      <motion.div variants={itemVariants} className='flex items-center gap-1 rounded-xl bg-white/50 border border-border/50 p-1 backdrop-blur-sm w-fit'>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              tab === t.id ? 'bg-brand-navy text-white shadow-soft' : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
            )}
          >
            {t.label}
          </button>
        ))}
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className='relative overflow-hidden'>
          <CardWatermark opacity={2} scale={1} />
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Icons.inbox className='h-5 w-5 text-brand-cornflower' />
              {tab === 'all' ? 'All Forms' : `${TABS.find((t) => t.id === tab)?.label} Forms`}
            </CardTitle>
            <CardDescription>
              Forms created when a workflow step is marked as needing human input. Approving or rejecting
              resumes the paused workflow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>{error}</div>
            ) : isLoading ? (
              <div className='flex h-40 items-center justify-center'>
                <div className='h-10 w-10 animate-spin rounded-full border-4 border-brand-navy border-t-transparent' />
              </div>
            ) : (
              <DataTable
                rows={forms}
                columns={columns}
                getRowId={(r) => r.id}
                searchPlaceholder='Search by workflow or step name'
                searchableText={(r) => [r.workflowName, r.workflowStepName].join(' ')}
                onView={openForm}
                emptyMessage='No forms found.'
                defaultSortKey='createdAt'
                defaultSortDirection='desc'
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className='sm:max-w-3xl'>
          <DialogHeader>
            <DialogTitle>{selected?.workflowStepName}</DialogTitle>
            <DialogDescription>{selected?.workflowName}</DialogDescription>
          </DialogHeader>

          {selected && selected.status !== 'pending' && (
            <div className='flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm'>
              <StatusBadge status={selected.status} />
              <span className='text-muted-foreground'>
                {selected.reviewedBy ? `by ${selected.reviewedBy}` : ''}
                {selected.reviewedAt ? ` · ${new Date(selected.reviewedAt).toLocaleString()}` : ''}
              </span>
            </div>
          )}

          {htmlLoading ? (
            <div className='flex h-64 items-center justify-center'>
              <Icons.loader className='h-8 w-8 animate-spin text-brand-cornflower' />
            </div>
          ) : htmlError ? (
            <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>{htmlError}</div>
          ) : (
            <iframe
              ref={iframeRef}
              srcDoc={formHtml ?? ''}
              sandbox='allow-same-origin'
              title='Form content'
              className='h-[50vh] w-full rounded-xl border border-border bg-white'
            />
          )}

          {decisionError && (
            <div className='flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700'>
              <Icons.alertCircle className='h-3.5 w-3.5 flex-shrink-0' />
              {decisionError}
            </div>
          )}

          <DialogFooter>
            <Button variant='outline' onClick={() => setDetailOpen(false)}>
              Close
            </Button>
            {selected?.status === 'pending' && (
              <>
                <Button
                  variant='outline'
                  className='gap-2 text-red-600 hover:bg-red-50 hover:text-red-700'
                  onClick={() => decide('reject')}
                  disabled={decisionLoading !== null || htmlLoading}
                >
                  {decisionLoading === 'reject' ? (
                    <Icons.loader className='h-4 w-4 animate-spin' />
                  ) : (
                    <Icons.close className='h-4 w-4' />
                  )}
                  Reject
                </Button>
                <Button
                  variant='gradient'
                  className='gap-2'
                  onClick={() => decide('approve')}
                  disabled={decisionLoading !== null || htmlLoading}
                >
                  {decisionLoading === 'approve' ? (
                    <Icons.loader className='h-4 w-4 animate-spin' />
                  ) : (
                    <Icons.checkCircle className='h-4 w-4' />
                  )}
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
