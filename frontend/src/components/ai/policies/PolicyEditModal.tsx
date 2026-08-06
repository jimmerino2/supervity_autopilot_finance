'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/ui/icons'
import { apiClient } from '@/lib/api-client'
import type { Policy } from './PolicyCard'

// ============================================================================
// Types
// ============================================================================

interface PolicyEditModalProps {
  policy: Policy | null
  isOpen: boolean
  onClose: () => void
  onSave: (policy: Policy) => void
}

interface FormData {
  name: string
  details: string
}

// ============================================================================
// Animation Variants
// ============================================================================

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
}

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
}

// ============================================================================
// Component
// ============================================================================

export function PolicyEditModal({ policy, isOpen, onClose, onSave }: PolicyEditModalProps) {
  const [formData, setFormData] = useState<FormData>({ name: '', details: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize form when policy changes
  useEffect(() => {
    if (policy) {
      setFormData({ name: policy.name, details: policy.details })
    } else {
      setFormData({ name: '', details: '' })
    }
    setError(null)
  }, [policy])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  const handleSave = useCallback(async () => {
    if (!formData.name.trim() || !formData.details.trim()) return

    setIsSaving(true)
    setError(null)
    try {
      const payload = { name: formData.name.trim(), details: formData.details.trim() }
      const savedPolicy = policy
        ? await apiClient.put<Policy>(`/api/policies/${policy.id}`, payload)
        : await apiClient.post<Policy>('/api/policies', payload)

      onSave(savedPolicy)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save policy. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [formData, policy, onSave, onClose])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[500] flex items-center justify-center p-4"
        style={{
          backgroundColor: 'rgba(26, 35, 64, 0.5)',
          backdropFilter: 'blur(8px)',
        }}
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
      >
        <motion.div
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          variants={modalVariants}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', policy ? 'bg-blue-100' : 'bg-emerald-100')}>
                {policy ? (
                  <Icons.pencil className="h-5 w-5 text-blue-600" />
                ) : (
                  <Icons.plus className="h-5 w-5 text-emerald-600" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-brand-navy">
                  {policy ? 'Edit Policy' : 'Create New Policy'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {policy ? 'Modify the policy below' : 'Define a new policy'}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <Icons.close className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Policy Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Auto-Approve Low Value Invoices"
                className={cn(
                  'w-full px-3 py-2 rounded-lg border border-input',
                  'text-sm focus:outline-none focus:ring-2 focus:ring-brand-cornflower/50'
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Details *</label>
              <textarea
                value={formData.details}
                onChange={(e) => setFormData((prev) => ({ ...prev, details: e.target.value }))}
                placeholder="Describe the rule in plain English, e.g. 'Always ask for user confirmation before sending emails to vendors'"
                rows={5}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border border-input resize-none',
                  'text-sm focus:outline-none focus:ring-2 focus:ring-brand-cornflower/50'
                )}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                <Icons.alertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="gradient"
              onClick={handleSave}
              disabled={!formData.name.trim() || !formData.details.trim() || isSaving}
            >
              {isSaving ? (
                <>
                  <Icons.loader className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Icons.check className="h-4 w-4 mr-2" />
                  {policy ? 'Save Changes' : 'Create Policy'}
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
