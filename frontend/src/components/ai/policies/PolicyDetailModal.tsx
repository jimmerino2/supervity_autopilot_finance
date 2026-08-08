'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/ui/icons'
import type { Policy } from './PolicyCard'

// ============================================================================
// Types
// ============================================================================

interface PolicyDetailModalProps {
  policy: Policy | null
  isOpen: boolean
  onClose: () => void
  onEdit: (policy: Policy) => void
  onDelete: (id: number) => void
}

// ============================================================================
// Helpers
// ============================================================================

const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ============================================================================
// Animation Variants
// ============================================================================

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

const modalVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 30 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.15 },
  },
}

const contentVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

// ============================================================================
// Component
// ============================================================================

export function PolicyDetailModal({ policy, isOpen, onClose, onEdit, onDelete }: PolicyDetailModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  // Reset delete confirm when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowDeleteConfirm(false)
    }
  }, [isOpen])

  const handleDelete = useCallback(() => {
    if (!policy) return
    if (showDeleteConfirm) {
      onDelete(policy.id)
      onClose()
    } else {
      setShowDeleteConfirm(true)
      setTimeout(() => setShowDeleteConfirm(false), 3000)
    }
  }, [showDeleteConfirm, onDelete, policy, onClose])

  const handleEdit = useCallback(() => {
    if (policy) {
      onEdit(policy)
      onClose()
    }
  }, [policy, onEdit, onClose])

  if (!mounted) return null

  const modalContent = (
    <AnimatePresence mode="wait">
      {isOpen && policy && (
        <motion.div
          key="modal-overlay"
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            zIndex: 9999,
            backgroundColor: 'rgba(26, 35, 64, 0.6)',
            backdropFilter: 'blur(8px)',
          }}
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            key="modal-content"
            className="relative w-full max-w-xl max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            variants={modalVariants}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <motion.div
              className="flex items-start justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex-1 pr-4">
                <h2 className="text-xl font-semibold text-brand-navy mb-1">{policy.name}</h2>
                <p className="text-xs text-muted-foreground">
                  Created by {policy.created_by} · {formatDateTime(policy.created_at)}
                </p>
              </div>
              <motion.div
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
                  <Icons.close className="h-5 w-5" />
                </Button>
              </motion.div>
            </motion.div>

            {/* Content */}
            <motion.div
              className="flex-1 overflow-y-auto p-6 space-y-4"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={itemVariants}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-brand-cornflower/10">
                    <Icons.layers className="h-4 w-4 text-brand-cornflower" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Details</span>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{policy.details}</p>
                </div>
              </motion.div>
            </motion.div>

            {/* Footer Actions */}
            <motion.div
              className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className={cn(
                    'transition-all',
                    showDeleteConfirm
                      ? 'text-white bg-red-500 hover:bg-red-600 border-red-500'
                      : 'text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200'
                  )}
                >
                  <Icons.trash className="h-4 w-4 mr-1.5" />
                  {showDeleteConfirm ? 'Confirm Delete' : 'Delete'}
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button variant="gradient" size="sm" onClick={handleEdit}>
                  <Icons.pencil className="h-4 w-4 mr-1.5" />
                  Edit Policy
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(modalContent, document.body)
}
