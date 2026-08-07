'use client'

import { cn } from '@/lib/utils'
import { Icons } from '@/components/ui/icons'

// Mirrors a row in the Supabase `insights` table, populated by the
// "Insights for Invoices" workflow (Supervity workflow
// 019fd81f-d403-7000-9889-ea9235e8454a).
export interface Insight {
  id: number
  created_at: string
  type: string
  details: string
  recommendation: string
}

interface InsightCardProps {
  insight: Insight
}

const typeConfig: Record<
  string,
  {
    label: string
    icon: typeof Icons.alertCircle
    bg: string
    border: string
    iconBg: string
    iconColor: string
    badge: string
  }
> = {
  critical: {
    label: 'Critical',
    icon: Icons.alertCircle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    badge: 'bg-red-100 text-red-700',
  },
  warning: {
    label: 'Warning',
    icon: Icons.alertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-700',
  },
}

const fallbackConfig = {
  label: 'Info',
  icon: Icons.info,
  bg: 'bg-slate-50',
  border: 'border-slate-200',
  iconBg: 'bg-slate-100',
  iconColor: 'text-slate-600',
  badge: 'bg-slate-100 text-slate-700',
}

function formatDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function InsightCard({ insight }: InsightCardProps) {
  const config = typeConfig[insight.type.toLowerCase()] || fallbackConfig
  const Icon = config.icon
  const date = formatDate(insight.created_at)

  return (
    <div className={cn('rounded-xl border p-4', 'transition-all duration-200 hover:shadow-soft', config.bg, config.border)}>
      <div className="flex gap-4">
        <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg', config.iconBg)}>
          <Icon className={cn('h-5 w-5', config.iconColor)} strokeWidth={1.5} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', config.badge)}>
              {config.label}
            </span>
            {date && <span className="text-xs text-muted-foreground">{date}</span>}
          </div>

          <p className="mt-2 text-sm text-foreground">{insight.details}</p>

          <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/60 p-3">
            <Icons.lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5 text-brand-cornflower" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">{insight.recommendation}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
