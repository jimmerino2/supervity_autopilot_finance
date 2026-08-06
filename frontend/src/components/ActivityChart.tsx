'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { Icons } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

export interface ActivityChartDatum {
  name: string
  runs: number
  completed: number
  failed: number
}

// Custom tooltip component
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className='rounded-xl border border-white/60 bg-white/95 p-3 shadow-float backdrop-blur-sm'>
      <p className='mb-2 text-xs font-medium text-brand-navy'>{label}</p>
      <div className='space-y-1'>
        {payload.map((entry, index) => (
          <div key={index} className='flex items-center gap-2 text-xs'>
            <div
              className='h-2 w-2 rounded-full'
              style={{ backgroundColor: entry.color }}
            />
            <span className='capitalize text-muted-foreground'>
              {entry.name}:
            </span>
            <span className='font-semibold text-brand-navy'>
              {entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ActivityChartProps {
  className?: string
  title?: string
  description?: string
  data?: ActivityChartDatum[]
  isLoading?: boolean
}

export function ActivityChart({
  className,
  title = 'Agent Run Activity',
  description = 'Based on the most recently fetched runs — sparser days reflect sample size, not necessarily no activity',
  data,
  isLoading = false,
}: ActivityChartProps) {
  const hasData = Boolean(data && data.length > 0)
  const chartData = data ?? []

  const totalRuns = chartData.reduce((acc, d) => acc + d.runs, 0)
  const totalCompleted = chartData.reduce((acc, d) => acc + d.completed, 0)
  const totalFailed = chartData.reduce((acc, d) => acc + d.failed, 0)
  const finished = totalCompleted + totalFailed
  const successRate = finished > 0 ? Math.round((totalCompleted / finished) * 100) : null

  const firstDayRuns = chartData[0]?.runs ?? 0
  const lastDayRuns = chartData[chartData.length - 1]?.runs ?? 0
  const trend = firstDayRuns > 0 ? (((lastDayRuns - firstDayRuns) / firstDayRuns) * 100).toFixed(1) : null
  const isPositive = trend !== null ? parseFloat(trend) >= 0 : true

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardWatermark opacity={4} scale={1.2} />

      <CardHeader className='pb-2'>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <Icons.activity
                className='h-5 w-5 text-brand-cornflower'
                strokeWidth={1.5}
              />
              {title}
            </CardTitle>
            <p className='mt-1 text-sm text-muted-foreground'>{description}</p>
          </div>

          {/* Quick Stats */}
          {hasData && (
            <div className='hidden items-center gap-4 sm:flex'>
              <div className='text-right'>
                <p className='text-micro uppercase text-brand-muted'>
                  Total Runs
                </p>
                <p className='font-display text-lg font-bold text-brand-navy'>
                  {totalRuns.toLocaleString()}
                </p>
              </div>
              <div className='h-10 w-px bg-border/50' />
              <div className='text-right'>
                <p className='text-micro uppercase text-brand-muted'>
                  Success Rate
                </p>
                <p className='font-display text-lg font-bold text-brand-navy'>
                  {successRate !== null ? `${successRate}%` : '—'}
                </p>
              </div>
              {trend !== null && (
                <motion.div
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                    isPositive
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-red-50 text-red-500'
                  )}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {isPositive ? (
                    <Icons.trendingUp className='h-3 w-3' strokeWidth={2} />
                  ) : (
                    <Icons.trendingUp
                      className='h-3 w-3 rotate-180'
                      strokeWidth={2}
                    />
                  )}
                  {isPositive ? '+' : ''}
                  {trend}%
                </motion.div>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className='pt-0'>
        <div className='mt-4 h-[240px] w-full'>
          {isLoading && !hasData ? (
            <div className='flex h-full items-center justify-center'>
              <div className='h-10 w-10 animate-spin rounded-full border-4 border-brand-navy border-t-transparent' />
            </div>
          ) : !hasData ? (
            <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
              No workflow runs recorded yet.
            </div>
          ) : (
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  {/* Gradient for total runs */}
                  <linearGradient
                    id='gradientRuns'
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'
                  >
                    <stop offset='0%' stopColor='#5B8DEF' stopOpacity={0.4} />
                    <stop offset='95%' stopColor='#5B8DEF' stopOpacity={0} />
                  </linearGradient>
                  {/* Gradient for completed */}
                  <linearGradient
                    id='gradientCompleted'
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'
                  >
                    <stop offset='0%' stopColor='#7C5CE7' stopOpacity={0.3} />
                    <stop offset='95%' stopColor='#7C5CE7' stopOpacity={0} />
                  </linearGradient>
                  {/* Gradient for failed */}
                  <linearGradient id='gradientFailed' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#EF4444' stopOpacity={0.25} />
                    <stop offset='95%' stopColor='#EF4444' stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray='3 3'
                  stroke='rgba(20, 26, 66, 0.06)'
                  vertical={false}
                />

                <XAxis
                  dataKey='name'
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: '#7B8AB8',
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                  dy={8}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  tick={{
                    fill: '#7B8AB8',
                    fontSize: 11,
                  }}
                  tickFormatter={(value) =>
                    value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
                  }
                />

                <Tooltip content={<CustomTooltip />} />

                {/* Failed - background layer */}
                <Area
                  type='monotone'
                  dataKey='failed'
                  name='Failed'
                  stroke='#EF4444'
                  strokeWidth={1.5}
                  fill='url(#gradientFailed)'
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: '#EF4444',
                    stroke: '#fff',
                    strokeWidth: 2,
                  }}
                />

                {/* Completed - middle layer */}
                <Area
                  type='monotone'
                  dataKey='completed'
                  name='Completed'
                  stroke='#7C5CE7'
                  strokeWidth={2}
                  fill='url(#gradientCompleted)'
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: '#7C5CE7',
                    stroke: '#fff',
                    strokeWidth: 2,
                  }}
                />

                {/* Total runs - top layer */}
                <Area
                  type='monotone'
                  dataKey='runs'
                  name='Total Runs'
                  stroke='#5B8DEF'
                  strokeWidth={2.5}
                  fill='url(#gradientRuns)'
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: '#5B8DEF',
                    stroke: '#fff',
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Legend */}
        {hasData && (
          <div className='mt-4 flex items-center justify-center gap-6 border-t border-border/30 pt-4'>
            <div className='flex items-center gap-2'>
              <div className='h-2 w-2 rounded-full bg-brand-cornflower' />
              <span className='text-xs text-muted-foreground'>Total Runs</span>
            </div>
            <div className='flex items-center gap-2'>
              <div className='h-2 w-2 rounded-full bg-brand-purple' />
              <span className='text-xs text-muted-foreground'>Completed</span>
            </div>
            <div className='flex items-center gap-2'>
              <div className='h-2 w-2 rounded-full bg-red-500' />
              <span className='text-xs text-muted-foreground'>Failed</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
