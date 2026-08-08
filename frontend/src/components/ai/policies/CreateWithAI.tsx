'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/ui/icons'

// ============================================================================
// Types
// ============================================================================

interface CreateWithAIProps {
  onPolicyCreate: (policy: { name: string; details: string }) => Promise<void>
  onCancel?: () => void
}

// ============================================================================
// Helpers
// ============================================================================

/** Naive title suggestion from the first few words of the rule text. */
function suggestName(input: string): string {
  const words = input.trim().split(/\s+/).slice(0, 6)
  const title = words.join(' ')
  return title.length < input.trim().length ? `${title}…` : title
}

// ============================================================================
// Main Component
// ============================================================================

export function CreateWithAI({ onPolicyCreate, onCancel }: CreateWithAIProps) {
  const [input, setInput] = useState('')
  const [policyName, setPolicyName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Conflict check against existing policies (Supervity "Policy Conflict Checker" operator)
  const [isCheckingConflict, setIsCheckingConflict] = useState(false)
  const [conflictBlock, setConflictBlock] = useState<string | null>(null)
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)

  // Keep the name in sync with the description until the user edits it directly.
  useEffect(() => {
    if (!nameTouched) setPolicyName(suggestName(input))
  }, [input, nameTouched])

  // Example policies
  const examples = [
    'Auto-approve invoices under $500 from approved vendors',
    'Escalate support tickets from enterprise customers to Tier 2',
    'When a new employee joins, assign the onboarding checklist',
  ]

  const handleSave = useCallback(async () => {
    if (!input.trim() || !policyName.trim()) return

    setError(null)
    setConflictBlock(null)
    setConflictWarning(null)
    setIsCheckingConflict(true)

    try {
      const result = await apiClient.post<{ status: boolean; message: string }>('/api/policies/check-conflict', {
        description: input.trim(),
      })
      if (result.status) {
        // Blocked — surface the conflict and let the user revise before retrying.
        setConflictBlock(result.message)
        setIsCheckingConflict(false)
        return
      }
    } catch {
      // Conflict checker unavailable — don't hard-block policy creation on an
      // infrastructure issue, but make sure the user knows it wasn't verified.
      setConflictWarning('Conflict check is currently unavailable. This policy has not been verified against existing ones.')
    }
    setIsCheckingConflict(false)

    setIsSaving(true)
    try {
      await onPolicyCreate({ name: policyName.trim(), details: input.trim() })
    } catch {
      setError('Failed to save policy. Please try again.')
      setIsSaving(false)
    }
  }, [input, policyName, onPolicyCreate])

  const isBusy = isCheckingConflict || isSaving

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-brand-navy">Create Policy</h2>
          <p className="text-muted-foreground mt-1">
            Describe your business rule and save.
          </p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200 p-6 shadow-lg space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Policy Description *</label>
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                if (conflictBlock) setConflictBlock(null)
              }}
              placeholder="Example: Auto-approve invoices under $500 from approved vendors..."
              rows={5}
              className={cn(
                'w-full rounded-lg border-0 bg-gray-50 p-4',
                'text-base text-foreground placeholder:text-muted-foreground',
                'resize-none focus:outline-none focus:ring-2 focus:ring-brand-cornflower/50',
                'transition-all duration-200'
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Policy Name *</label>
            <input
              type="text"
              value={policyName}
              onChange={(e) => {
                setPolicyName(e.target.value)
                setNameTouched(true)
              }}
              placeholder="Auto-filled from your description — edit if you'd like"
              className="w-full px-4 py-2 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-brand-cornflower/50"
            />
          </div>

          {conflictBlock && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <Icons.alertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Conflict detected</p>
                <p className="mt-0.5">{conflictBlock}</p>
                <p className="mt-1 text-red-600">Revise your policy above to resolve the conflict before saving.</p>
              </div>
            </div>
          )}

          {conflictWarning && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
              <Icons.alertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>{conflictWarning}</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <Icons.alertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={!input.trim() || !policyName.trim() || isBusy}
              variant="gradient"
              className="flex-1"
              size="lg"
            >
              {isCheckingConflict ? (
                <>
                  <Icons.loader className="mr-2 h-5 w-5 animate-spin" />
                  Checking for conflicts...
                </>
              ) : isSaving ? (
                <>
                  <Icons.loader className="mr-2 h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Icons.check className="mr-2 h-5 w-5" />
                  Save Policy
                </>
              )}
            </Button>
            {onCancel && (
              <Button variant="ghost" onClick={onCancel} disabled={isBusy}>
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Examples */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Try an example
          </p>
          <div className="flex flex-wrap gap-2">
            {examples.map((example, idx) => (
              <button
                key={idx}
                onClick={() => setInput(example)}
                className={cn(
                  'text-sm text-left px-3 py-2 rounded-lg',
                  'bg-white border border-gray-200 text-gray-700',
                  'hover:border-brand-cornflower hover:bg-brand-cornflower/5 transition-colors',
                  'max-w-full'
                )}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
