'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { InvoiceReviewForm, parseReviewForm } from './InvoiceReviewForm'

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

/** Reads reviewer-filled values out of the sandboxed form iframe — used only
 * for forms that don't match the known review-form shape (see InvoiceReviewForm). */
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

// ============================================================================
// Component
// ============================================================================

interface UserFormsListProps {
  /** While true, the list auto-refreshes every 5s (plus once immediately on
   * both the true and false edges) — used to keep pace with the "Generate
   * Invoice Review Forms" orchestrator while it's actively creating requests. */
  refreshWhile?: boolean
}

export function UserFormsList({ refreshWhile }: UserFormsListProps = {}) {
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
  const [notifyWarning, setNotifyWarning] = useState<string | null>(null)
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

  const wasRefreshingRef = useRef(false)
  useEffect(() => {
    const wasRefreshing = wasRefreshingRef.current
    wasRefreshingRef.current = !!refreshWhile

    if (refreshWhile) {
      load()
      const interval = setInterval(load, 5000)
      return () => clearInterval(interval)
    } else if (wasRefreshing) {
      // Just stopped running — one more refresh to catch the final state.
      load()
    }
  }, [refreshWhile, load])

  const openForm = useCallback(async (form: UserForm) => {
    setSelected(form)
    setDetailOpen(true)
    setFormHtml(null)
    setHtmlError(null)
    setDecisionError(null)
    setNotifyWarning(null)
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

  // The custom review UI only applies to forms whose HTML matches the known
  // "invoice field table + status select" shape (currently produced by the
  // manual-review workflow) — anything else falls back to the raw iframe.
  const parsedForm = useMemo(() => (formHtml ? parseReviewForm(formHtml) : null), [formHtml])
  const showCustomForm = selected?.status === 'pending' && parsedForm !== null

  const decide = useCallback(
    async (status: 'approve' | 'reject', fields: Record<string, string>, notifyCustomer: boolean) => {
      if (!selected) return
      setDecisionLoading(status)
      setDecisionError(null)
      setNotifyWarning(null)
      try {
        await apiClient.post(`/api/supervity/user-forms/${selected.activityRunId}/${status}`, { fields })

        if (notifyCustomer && status === 'approve') {
          try {
            await apiClient.post(`/api/supervity/user-forms/${selected.activityRunId}/notify-customer`, {
              invoiceDocNumbers: parsedForm?.invoices.map((i) => i.docNumber) ?? [],
            })
          } catch (err) {
            // Best-effort — the approval already succeeded, so don't block on this.
            setNotifyWarning(err instanceof Error ? err.message : 'Unable to send customer notification.')
          }
        }

        setDetailOpen(false)
        await load()
      } catch (err) {
        setDecisionError(err instanceof Error ? err.message : `Failed to ${status} form`)
      } finally {
        setDecisionLoading(null)
      }
    },
    [selected, load, parsedForm]
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
    <>
      <Card className='relative overflow-hidden'>
        <CardWatermark opacity={2} scale={1} />
        <CardHeader>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <Icons.fileText className='h-5 w-5 text-brand-cornflower' />
                Invoice Manual Approval Requests
              </CardTitle>
              <CardDescription>
                Invoices routed for manual review — approving or rejecting resumes the paused workflow.
              </CardDescription>
            </div>
            <div className='flex items-center gap-1 rounded-xl bg-white/50 border border-border/50 p-1 backdrop-blur-sm w-fit'>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    tab === t.id ? 'bg-brand-navy text-white shadow-soft' : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
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
              emptyMessage='No approval requests found.'
              defaultSortKey='createdAt'
              defaultSortDirection='desc'
            />
          )}
        </CardContent>
      </Card>

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
          ) : showCustomForm && parsedForm ? (
            <div className='max-h-[65vh] overflow-y-auto pr-1'>
              <InvoiceReviewForm parsed={parsedForm} onSubmit={decide} isSubmitting={decisionLoading} />
            </div>
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

          {notifyWarning && (
            <div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700'>
              <Icons.alertTriangle className='h-3.5 w-3.5 flex-shrink-0' />
              Approved, but the customer notification didn&apos;t go through: {notifyWarning}
            </div>
          )}

          {/* The custom review form has its own Approve/Reject buttons built
              in; this footer only handles Close plus the raw-iframe fallback. */}
          <DialogFooter>
            <Button variant='outline' onClick={() => setDetailOpen(false)}>
              Close
            </Button>
            {selected?.status === 'pending' && !showCustomForm && (
              <>
                <Button
                  variant='outline'
                  className='gap-2 text-red-600 hover:bg-red-50 hover:text-red-700'
                  onClick={() => decide('reject', extractFormFields(iframeRef.current), false)}
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
                  onClick={() => decide('approve', extractFormFields(iframeRef.current), false)}
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
    </>
  )
}
