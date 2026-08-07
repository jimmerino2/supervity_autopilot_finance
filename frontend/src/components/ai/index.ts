/**
 * AI Components - Export all AI-related components
 */

// Main AI Manager
export { AIManager } from './AIManager'
export { ChatMessage } from './ChatMessage'
export { ChatInput } from './ChatInput'
export { CapabilityBubbles } from './CapabilityBubbles'
export { TeachAI } from './TeachAI'

// Policy Components - New
export { PolicyCard } from './policies/PolicyCard'
export type { Policy } from './policies/PolicyCard'
export { PolicyDetailModal } from './policies/PolicyDetailModal'
export { PolicyEditModal } from './policies/PolicyEditModal'
export { CreateWithAI } from './policies/CreateWithAI'

// Policy Components - Legacy (used by TeachAI)
export { RuleBuilderModal } from './policies/RuleBuilderModal'
export type { RuleFormData, RuleAnalysis, RuleConflict, RuleOverride } from './policies/RuleBuilderModal'

// Insight Components
export { InsightCard } from './insights/InsightCard'
export type { Insight, InsightType } from './insights/InsightCard'

