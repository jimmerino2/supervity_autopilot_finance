'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Icons } from '@/components/ui/icons'
import { parsePolicyName } from './policyCategories'

// ============================================================================
// Types — mirrors the `policies` table in Supabase
// ============================================================================

export interface Policy {
  id: number
  name: string
  details: string
  created_by: string
  created_at: string
}

interface PolicyCardProps {
  policy: Policy
  onClick: (policy: Policy) => void
}

// ============================================================================
// Helpers
// ============================================================================

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ============================================================================
// Main Component - Fixed Height Card with Animations
// ============================================================================

export function PolicyCard({ policy, onClick }: PolicyCardProps) {
  const { category, name } = parsePolicyName(policy.name)

  return (
    <motion.div
      onClick={() => onClick(policy)}
      className={cn(
        'relative h-[160px] rounded-xl border cursor-pointer',
        'bg-white',
        'flex flex-col group'
      )}
      whileHover={{
        y: -4,
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
        borderColor: 'rgba(156, 163, 175, 0.5)',
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-transparent to-gray-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-start gap-2 p-4 pb-2">
        <div className={cn('mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', 'bg-brand-cornflower/10')}>
          <Icons.layers className="h-4 w-4 text-brand-cornflower" />
        </div>
        <div className="min-w-0 mt-0.5">
          {category && (
            <span className="inline-block mb-0.5 rounded-full bg-brand-cornflower/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-cornflower">
              {category}
            </span>
          )}
          <h3 className="font-semibold text-brand-navy line-clamp-1 text-sm group-hover:text-brand-cornflower transition-colors duration-200">
            {name}
          </h3>
        </div>
      </div>

      {/* Details - Fixed lines */}
      <div className="relative px-4 pb-2 flex-1 min-h-0">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {policy.details}
        </p>
      </div>

      {/* Footer - Fixed at bottom */}
      <div className="relative flex items-center justify-between px-4 py-3 border-t border-gray-100 mt-auto bg-gray-50/50 rounded-b-xl">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="truncate max-w-[140px]">{policy.created_by}</span>
          <span>{formatDate(policy.created_at)}</span>
        </div>

        {/* Click hint with animation */}
        <motion.div
          className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-brand-cornflower transition-colors duration-200"
          initial={{ x: 0 }}
          whileHover={{ x: 2 }}
        >
          <span>View</span>
          <Icons.chevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
        </motion.div>
      </div>
    </motion.div>
  )
}
