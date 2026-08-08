'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { Icons } from '@/components/ui/icons'
import { PolicyCard, type Policy } from '@/components/ai/policies/PolicyCard'
import { PolicyDetailModal } from '@/components/ai/policies/PolicyDetailModal'
import { PolicyEditModal } from '@/components/ai/policies/PolicyEditModal'
import { CreateWithAI } from '@/components/ai/policies/CreateWithAI'

// ============================================================================
// Animation Variants
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

// ============================================================================
// Types
// ============================================================================

type TabType = 'policies' | 'create-ai'
type SortType = 'newest' | 'oldest' | 'name'

// ============================================================================
// Tab Configuration
// ============================================================================

const TABS = [
  { id: 'policies' as TabType, label: 'Policies', Icon: Icons.layers },
  { id: 'create-ai' as TabType, label: 'Create with AI', Icon: Icons.sparkles },
]

// ============================================================================
// Page Component
// ============================================================================

export default function AIPoliciesPage() {
  // State
  const [policies, setPolicies] = useState<Policy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('policies')

  // Modal state
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // Filters
  const [sortBy, setSortBy] = useState<SortType>('newest')
  const [searchQuery, setSearchQuery] = useState('')

  // ============================================================================
  // Data
  // ============================================================================

  const loadPolicies = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiClient.get<Policy[]>('/api/policies')
      setPolicies(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load policies')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPolicies()
  }, [loadPolicies])

  // ============================================================================
  // Policy Actions
  // ============================================================================

  const handleCardClick = useCallback((policy: Policy) => {
    setSelectedPolicy(policy)
    setIsDetailModalOpen(true)
  }, [])

  const handleEditFromDetail = useCallback((policy: Policy) => {
    setEditingPolicy(policy)
    setIsEditModalOpen(true)
  }, [])

  const handleSavePolicy = useCallback(async () => {
    await loadPolicies()
  }, [loadPolicies])

  const deletePolicy = useCallback(async (id: number) => {
    try {
      await apiClient.delete(`/api/policies/${id}`)
      await loadPolicies()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete policy')
    }
  }, [loadPolicies])

  const handlePolicyCreate = async (policyData: { name: string; details: string }) => {
    await apiClient.post('/api/policies', policyData)
    await loadPolicies()
    setActiveTab('policies')
  }

  // ============================================================================
  // Filtering & Sorting
  // ============================================================================

  const filteredPolicies = policies
    .filter((policy) => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        policy.name.toLowerCase().includes(query) ||
        policy.details.toLowerCase().includes(query) ||
        policy.created_by.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

  // ============================================================================
  // Stats
  // ============================================================================

  const stats = {
    total: policies.length,
    contributors: new Set(policies.map((p) => p.created_by)).size,
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-display-3 font-bold tracking-tight text-brand-navy lg:text-display-2">
            AI Policies
          </h1>
          <p className="mt-1 text-lg text-muted-foreground">
            Define approval rules for equipment, maintenance, and subscription invoices — in plain language.
          </p>
        </div>
        <Button
          variant="gradient"
          onClick={() => setActiveTab('create-ai')}
          className={activeTab !== 'policies' ? 'opacity-50' : ''}
        >
          <Icons.plus className="mr-2 h-4 w-4" />
          Check for Conflicts
        </Button>
      </motion.div>

      {/* Tabs - AT THE TOP */}
      <motion.div variants={itemVariants}>
        <div className="flex gap-1 p-1.5 bg-gray-100 rounded-xl w-fit">
          {TABS.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'text-brand-navy'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              whileHover={{ scale: activeTab === tab.id ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white rounded-lg shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <tab.Icon className="h-4 w-4" />
                {tab.label}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="popLayout">
        {activeTab === 'policies' && (
          <motion.div
            key="policies-tab"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            {/* Stats Bar */}
            <div className="grid grid-cols-2 gap-4 sm:max-w-md">
              {[
                { value: stats.total, label: 'Total Policies', icon: Icons.layers, bg: 'bg-brand-navy/10', color: 'text-brand-navy' },
                { value: stats.contributors, label: 'Contributors', icon: Icons.user, bg: 'bg-emerald-100', color: 'text-emerald-600' },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-md transition-all cursor-default"
                  whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      className={cn('p-2 rounded-lg', stat.bg)}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <stat.icon className={cn('h-5 w-5', stat.color)} />
                    </motion.div>
                    <div>
                      <p className={cn('text-2xl font-bold', stat.color)}>
                        {stat.value}
                      </p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Filters & Search */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search policies..."
                  className={cn(
                    'w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-white',
                    'text-sm focus:outline-none focus:ring-2 focus:ring-brand-cornflower/50'
                  )}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortType)}
                  className="px-3 py-2.5 rounded-lg border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-cornflower/50"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </motion.div>

            {/* Policy Grid */}
            <motion.div variants={itemVariants}>
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Icons.loader className="h-8 w-8 animate-spin text-brand-cornflower" />
                </div>
              ) : error ? (
                <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
              ) : filteredPolicies.length === 0 ? (
                <Card className="relative overflow-hidden">
                  <CardWatermark opacity={3} scale={1} />
                  <CardContent className="relative z-10 flex flex-col items-center justify-center py-16 text-center">
                    <div className={cn(
                      'mb-4 flex h-16 w-16 items-center justify-center rounded-2xl',
                      'bg-gradient-to-br from-brand-cornflower/20 to-brand-purple/20'
                    )}>
                      <Icons.brain className="h-8 w-8 text-brand-cornflower" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-display text-lg font-semibold text-brand-navy">
                      {searchQuery ? 'No matching policies' : 'No policies yet'}
                    </h3>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      {searchQuery
                        ? 'Try adjusting your search.'
                        : 'Create your first AI policy using natural language.'}
                    </p>
                    <Button
                      variant="gradient"
                      className="mt-6"
                      onClick={() => setActiveTab('create-ai')}
                    >
                      <Icons.sparkles className="mr-2 h-4 w-4" />
                      Create with AI
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPolicies.map((policy) => (
                    <PolicyCard
                      key={policy.id}
                      policy={policy}
                      onClick={handleCardClick}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {activeTab === 'create-ai' && (
          <motion.div
            key="create-ai-tab"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
          >
            <Card className="relative overflow-hidden">
              <CardWatermark opacity={2} scale={1} />
              <CardContent className="relative z-10 py-8">
                <CreateWithAI
                  onPolicyCreate={handlePolicyCreate}
                  onCancel={() => setActiveTab('policies')}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal - View only */}
      <PolicyDetailModal
        policy={selectedPolicy}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedPolicy(null)
        }}
        onEdit={handleEditFromDetail}
        onDelete={(id) => {
          deletePolicy(id)
          setIsDetailModalOpen(false)
        }}
      />

      {/* Edit Modal */}
      <PolicyEditModal
        policy={editingPolicy}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingPolicy(null)
        }}
        onSave={handleSavePolicy}
      />
    </motion.div>
  )
}
