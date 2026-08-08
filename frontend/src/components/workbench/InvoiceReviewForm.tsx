'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/ui/icons'

// ============================================================================
// Parsing — the Supervity-generated HTML for this review form isn't JSON, so
// we scrape the known markup shape (a "field -> value" table plus a status
// select and reason textarea per invoice) into structured data via DOMParser,
// which never executes embedded scripts. Falls back gracefully — parseReviewForm
// returns null when the shape doesn't match, and the caller shows the raw
// form instead.
// ============================================================================

export interface InvoiceReviewBlock {
  docNumber: string
  fields: Record<string, string>
  statusFieldName: string
  reasonFieldName: string
}

export interface ParsedReviewForm {
  emailFieldName: string | null
  invoices: InvoiceReviewBlock[]
}

export function parseReviewForm(html: string): ParsedReviewForm | null {
  if (typeof window === 'undefined') return null

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const emailInput = doc.querySelector('input[name="user_email"]')

  const invoices: InvoiceReviewBlock[] = []
  const tables = Array.from(doc.querySelectorAll('table'))

  for (const table of tables) {
    const fields: Record<string, string> = {}
    for (const row of Array.from(table.querySelectorAll('tbody tr'))) {
      const cells = row.querySelectorAll('td')
      if (cells.length !== 2) continue
      const label = cells[0].textContent?.trim()
      const value = cells[1].textContent?.trim()
      if (label) fields[label] = value ?? ''
    }

    const docNumber = fields['Doc Number']
    if (!docNumber) continue

    // The status select/reason textarea live in the same card as the table,
    // named e.g. new_status_5110000100 / blocked_reason_5110000100.
    const card = table.closest('.ag-card') ?? table.parentElement
    const selectEl = card?.querySelector('select[name^="new_status_"]')
    const textareaEl = card?.querySelector('textarea[name^="blocked_reason_"]')

    invoices.push({
      docNumber,
      fields,
      statusFieldName: selectEl?.getAttribute('name') || `new_status_${docNumber}`,
      reasonFieldName: textareaEl?.getAttribute('name') || `blocked_reason_${docNumber}`,
    })
  }

  if (invoices.length === 0) return null

  return { emailFieldName: emailInput ? 'user_email' : null, invoices }
}

// ============================================================================
// "Things to check" hints, keyed by blocked-reason code. blocked_reason can
// be a comma-separated list of multiple codes.
// ============================================================================

const REASON_HINTS: Record<string, string> = {
  VENDOR_COUNTRY_MISMATCH:
    "The vendor's registered country doesn't match what's expected for this company code — confirm the vendor master data and this invoice belong to the correct legal entity before approving.",
  COMPANY_CODE_UNKNOWN:
    "This company code isn't recognized in the Companies master list — verify it's a valid, active company code before approving.",
  DUPLICATE_INVOICE_NO:
    'This vendor invoice number matches another invoice already in the system — check for a duplicate submission before approving to avoid a double payment.',
}

function getReasonHints(blockedReason: string): { code: string; hint: string }[] {
  return blockedReason
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)
    .map((code) => ({
      code,
      hint: REASON_HINTS[code] || 'Review this flag before approving — no specific guidance is available for this code.',
    }))
}

// ============================================================================
// Additional data — the form's own HTML only embeds 7 fields. The "Doc
// Number" it gives us is the real invoices.invoice_doc_no key, so we pull
// the full record from our own API for richer review context (amount, PO,
// dates, bank account, etc). Best-effort: a failed/slow lookup just means
// that invoice's card shows the base 7 fields without the extra section.
// ============================================================================

interface InvoiceDetail {
  invoice_doc_no: number
  po_id: number | null
  document_date: string | null
  posting_date: string | null
  amount: string | null
  tax_amount: number | null
  source_channel: string | null
  bank_account_on_invoice: string | null
  gl_account_code: string | null
  extraction_confidence: number | null
  po_currency: string | null
}

const ADDITIONAL_FIELDS: { key: keyof InvoiceDetail; label: string; format?: (v: unknown) => string }[] = [
  { key: 'amount', label: 'Amount' },
  { key: 'po_id', label: 'PO ID' },
  { key: 'po_currency', label: 'PO Currency' },
  { key: 'document_date', label: 'Document Date' },
  { key: 'posting_date', label: 'Posting Date' },
  { key: 'tax_amount', label: 'Tax Amount' },
  { key: 'source_channel', label: 'Source Channel' },
  { key: 'bank_account_on_invoice', label: 'Bank Account' },
  { key: 'gl_account_code', label: 'GL Account' },
  {
    key: 'extraction_confidence',
    label: 'Extraction Confidence',
    format: (v) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : '—'),
  },
]

function useInvoiceDetails(docNumbers: string[]) {
  const [details, setDetails] = useState<Record<string, InvoiceDetail | null>>({})
  const [isLoading, setIsLoading] = useState(true)
  const key = docNumbers.join(',')

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    Promise.allSettled(docNumbers.map((doc) => apiClient.get<InvoiceDetail>(`/api/invoice/${doc}`))).then((results) => {
      if (cancelled) return
      const next: Record<string, InvoiceDetail | null> = {}
      results.forEach((result, idx) => {
        next[docNumbers[idx]] = result.status === 'fulfilled' ? result.value : null
      })
      setDetails(next)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { details, isLoading }
}

// ============================================================================
// Component
// ============================================================================

interface InvoiceReviewFormProps {
  parsed: ParsedReviewForm
  onSubmit: (status: 'approve' | 'reject', fields: Record<string, string>, notifyCustomer: boolean) => void | Promise<void>
  isSubmitting: 'approve' | 'reject' | null
}

export function InvoiceReviewForm({ parsed, onSubmit, isSubmitting }: InvoiceReviewFormProps) {
  const [email, setEmail] = useState('')
  const [statuses, setStatuses] = useState<Record<string, string>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [notifyCustomer, setNotifyCustomer] = useState(false)

  const docNumbers = useMemo(() => parsed.invoices.map((inv) => inv.docNumber), [parsed.invoices])
  const { details, isLoading: detailsLoading } = useInvoiceDetails(docNumbers)

  const allStatusesChosen = useMemo(
    () => parsed.invoices.every((inv) => Boolean(statuses[inv.docNumber])),
    [parsed.invoices, statuses]
  )
  const emailValid = !parsed.emailFieldName || email.trim().length > 0
  const canSubmit = emailValid && allStatusesChosen

  const buildFields = (): Record<string, string> => {
    const fields: Record<string, string> = {}
    if (parsed.emailFieldName) fields[parsed.emailFieldName] = email.trim()
    for (const inv of parsed.invoices) {
      fields[inv.statusFieldName] = statuses[inv.docNumber] ?? ''
      fields[inv.reasonFieldName] = reasons[inv.docNumber] ?? ''
    }
    return fields
  }

  const FIELD_ORDER = ['Doc Number', 'Vendor Invoice #', 'Vendor ID', 'Company Code', 'Currency', 'Status', 'Blocked Reason']

  return (
    <div className="space-y-5">
      {parsed.emailFieldName && (
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <label className="block text-sm font-medium text-foreground mb-1.5">Your Email Address *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="approver@example.com"
            className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-cornflower/50"
          />
          <p className="mt-1 text-xs text-muted-foreground">Required for logging the audit trail.</p>
        </div>
      )}

      <div className="space-y-4">
        {parsed.invoices.map((inv) => {
          const blockedReason = inv.fields['Blocked Reason']
          const hints = blockedReason ? getReasonHints(blockedReason) : []
          const status = statuses[inv.docNumber] ?? ''

          return (
            <div key={inv.docNumber} className="rounded-xl border border-border overflow-hidden">
              <div className="bg-brand-navy/5 px-4 py-3 border-b border-border">
                <h4 className="font-semibold text-brand-navy text-sm">Invoice {inv.docNumber}</h4>
              </div>

              <div className="p-4 space-y-4">
                {hints.length > 0 && (
                  <div className="space-y-2">
                    {hints.map(({ code, hint }) => (
                      <div key={code} className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <Icons.alertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">{code}</p>
                          <p className="mt-0.5 text-sm text-amber-800">{hint}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-gray-50 p-3">
                  {FIELD_ORDER.filter((label) => inv.fields[label] !== undefined).map((label) => (
                    <div key={label} className="text-sm">
                      <span className="text-muted-foreground">{label}: </span>
                      <span className="font-medium text-foreground">{inv.fields[label] || '—'}</span>
                    </div>
                  ))}
                </div>

                {detailsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icons.loader className="h-3.5 w-3.5 animate-spin" />
                    Loading additional details…
                  </div>
                ) : details[inv.docNumber] ? (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Additional Details
                    </p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-3">
                      {ADDITIONAL_FIELDS.map(({ key, label, format }) => {
                        const value = details[inv.docNumber]?.[key]
                        if (value === null || value === undefined || value === '') return null
                        return (
                          <div key={key} className="text-sm">
                            <span className="text-muted-foreground">{label}: </span>
                            <span className="font-medium text-foreground">{format ? format(value) : String(value)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">New Status *</label>
                    <select
                      value={status}
                      onChange={(e) => setStatuses((prev) => ({ ...prev, [inv.docNumber]: e.target.value }))}
                      className={cn(
                        'w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-cornflower/50',
                        status ? 'border-input' : 'border-red-300'
                      )}
                    >
                      <option value="" disabled>
                        Choose status…
                      </option>
                      <option value="open">Open</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Reason (if blocked)</label>
                    <textarea
                      value={reasons[inv.docNumber] ?? ''}
                      onChange={(e) => setReasons((prev) => ({ ...prev, [inv.docNumber]: e.target.value }))}
                      placeholder="Provide details if status is blocked..."
                      rows={1}
                      className="w-full rounded-lg border border-input px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-cornflower/50"
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/20 p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={notifyCustomer}
          onChange={(e) => setNotifyCustomer(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-input accent-brand-cornflower"
        />
        <span className="text-sm">
          <span className="font-medium text-foreground">Send email to customer</span>
          <span className="block text-muted-foreground text-xs mt-0.5">
            Notifies the customer once this review is submitted.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => onSubmit('reject', buildFields(), notifyCustomer)}
          disabled={!canSubmit || isSubmitting !== null}
        >
          {isSubmitting === 'reject' ? <Icons.loader className="h-4 w-4 animate-spin" /> : <Icons.close className="h-4 w-4" />}
          Reject
        </Button>
        <Button
          variant="gradient"
          className="flex-1 gap-2"
          onClick={() => onSubmit('approve', buildFields(), notifyCustomer)}
          disabled={!canSubmit || isSubmitting !== null}
        >
          {isSubmitting === 'approve' ? <Icons.loader className="h-4 w-4 animate-spin" /> : <Icons.checkCircle className="h-4 w-4" />}
          Approve
        </Button>
      </div>
    </div>
  )
}
