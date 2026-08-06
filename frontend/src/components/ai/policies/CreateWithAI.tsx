'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
// Step Components
// ============================================================================

function StepIndicator({ currentStep, steps }: { currentStep: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, idx) => (
        <div key={step} className="flex items-center">
          <div className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-all',
            idx < currentStep
              ? 'bg-emerald-500 text-white'
              : idx === currentStep
                ? 'bg-brand-cornflower text-white'
                : 'bg-gray-200 text-gray-500'
          )}>
            {idx < currentStep ? (
              <Icons.check className="h-4 w-4" />
            ) : (
              idx + 1
            )}
          </div>
          <span className={cn(
            'ml-2 text-sm font-medium hidden sm:inline',
            idx === currentStep ? 'text-brand-navy' : 'text-muted-foreground'
          )}>
            {step}
          </span>
          {idx < steps.length - 1 && (
            <div className={cn(
              'w-8 h-0.5 mx-3',
              idx < currentStep ? 'bg-emerald-500' : 'bg-gray-200'
            )} />
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function CreateWithAI({ onPolicyCreate, onCancel }: CreateWithAIProps) {
  const [step, setStep] = useState(0)
  const [input, setInput] = useState('')
  const [policyName, setPolicyName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Conflict check against existing policies (Supervity "Policy Conflict Checker" operator)
  const [isCheckingConflict, setIsCheckingConflict] = useState(false)
  const [conflictBlock, setConflictBlock] = useState<string | null>(null)
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)

  const steps = ['Describe', 'Review & Save']

  // Example policies
  const examples = [
    'Always ask for user confirmation before sending emails to vendors',
    'Auto-approve invoices under $500 from approved vendors',
    'Escalate support tickets from enterprise customers to Tier 2',
    'When a new employee joins, assign the onboarding checklist',
  ]

  const handleContinue = useCallback(async () => {
    if (!input.trim()) return

    setIsCheckingConflict(true)
    setConflictBlock(null)
    setConflictWarning(null)

    try {
      const result = await apiClient.post<{ status: boolean; message: string }>('/api/policies/check-conflict', {
        description: input.trim(),
      })
      if (result.status) {
        // Blocked — surface the conflict and stay on this step so the user can revise.
        setConflictBlock(result.message)
        setIsCheckingConflict(false)
        return
      }
    } catch {
      // Conflict checker unavailable — don't hard-block policy creation on an
      // infrastructure issue, but make sure the user knows it wasn't verified.
      setConflictWarning('Conflict check is currently unavailable. This policy has not been verified against existing ones.')
    }

    setPolicyName(suggestName(input))
    setIsCheckingConflict(false)
    setStep(1)
  }, [input])

  const handleBack = useCallback(() => {
    if (step > 0) setStep(step - 1)
  }, [step])

  const handleSave = useCallback(async () => {
    if (!policyName.trim() || !input.trim()) return

    setIsSaving(true)
    setError(null)

    try {
      await onPolicyCreate({ name: policyName.trim(), details: input.trim() })
    } catch {
      setError('Failed to save policy. Please try again.')
      setIsSaving(false)
    }
  }, [policyName, input, onPolicyCreate])

  return (
    <div className="w-full max-w-2xl mx-auto">
      <StepIndicator currentStep={step} steps={steps} />

      <AnimatePresence mode="wait">
        {/* ========== Step 1: Describe ========== */}
        {step === 0 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-brand-navy">Describe Your Policy</h2>
              <p className="text-muted-foreground mt-1">
                Write your business rule in plain English.
              </p>
            </div>

            <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200 p-6 shadow-lg">
              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  if (conflictBlock) setConflictBlock(null)
                }}
                placeholder="Example: Always ask for user confirmation before sending emails to vendors..."
                className={cn(
                  'w-full min-h-[180px] rounded-lg border-0 bg-gray-50 p-4',
                  'text-base text-foreground placeholder:text-muted-foreground',
                  'resize-none focus:outline-none focus:ring-2 focus:ring-brand-cornflower/50',
                  'transition-all duration-200'
                )}
              />

              {conflictBlock && (
                <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  <Icons.alertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Conflict detected</p>
                    <p className="mt-0.5">{conflictBlock}</p>
                    <p className="mt-1 text-red-600">Revise your policy above to resolve the conflict before continuing.</p>
                  </div>
                </div>
              )}

              {conflictWarning && (
                <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
                  <Icons.alertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>{conflictWarning}</p>
                </div>
              )}

              <div className="flex items-center gap-3 mt-4">
                <Button
                  onClick={handleContinue}
                  disabled={!input.trim() || isCheckingConflict}
                  variant="gradient"
                  className="flex-1"
                  size="lg"
                >
                  {isCheckingConflict ? (
                    <>
                      <Icons.loader className="mr-2 h-5 w-5 animate-spin" />
                      Checking for conflicts...
                    </>
                  ) : (
                    <>
                      <Icons.sparkles className="mr-2 h-5 w-5" />
                      Continue
                    </>
                  )}
                </Button>
                {onCancel && (
                  <Button variant="ghost" onClick={onCancel}>
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
        )}

        {/* ========== Step 2: Review & Save ========== */}
        {step === 1 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-brand-navy">Review & Save</h2>
              <p className="text-muted-foreground mt-1">
                Give your policy a name and confirm the details.
              </p>
            </div>

            {conflictWarning && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
                <Icons.alertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>{conflictWarning}</p>
              </div>
            )}

            <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200 p-6 shadow-lg space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Policy Name *</label>
                <input
                  type="text"
                  value={policyName}
                  onChange={(e) => setPolicyName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-brand-cornflower/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Details *</label>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 text-base resize-none focus:outline-none focus:ring-2 focus:ring-brand-cornflower/50"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                <Icons.alertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={handleBack}>
                <Icons.arrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleSave}
                disabled={!policyName.trim() || !input.trim() || isSaving}
                variant="gradient"
                className="flex-1"
                size="lg"
              >
                {isSaving ? (
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
