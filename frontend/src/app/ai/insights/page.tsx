'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CardWatermark } from '@/components/ui/card-watermark'
import { Icons } from '@/components/ui/icons'
import { InsightCard, type Insight } from '@/components/ai/insights/InsightCard'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function AIInsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasRun, setHasRun] = useState(false)

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true)
    setError(null)
    try {
      const result = await apiClient.post<{ insights: Insight[] }>('/api/insights/generate')
      setInsights(result.insights)
      setHasRun(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate insights')
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  const criticalCount = insights.filter((i) => i.type === 'critical').length
  const warningCount = insights.filter((i) => i.type === 'warning').length

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-display-3 font-bold tracking-tight text-brand-navy lg:text-display-2">
            AI Insights
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            AI-powered analysis of your invoice data. Discover anomalies, risks, and recommendations.
          </p>
        </div>
        <Button
          variant="gradient"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <Icons.loader className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Icons.sparkles className="mr-2 h-4 w-4" strokeWidth={1.5} />
              Run Analysis
            </>
          )}
        </Button>
      </motion.div>

      {/* Stats Cards */}
      {hasRun && (
        <motion.div variants={itemVariants} className="grid gap-4 sm:grid-cols-2">
          <Card className="relative overflow-hidden">
            <CardWatermark opacity={2} scale={0.8} />
            <CardContent className="relative z-10 flex items-center gap-4 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
                <Icons.alertCircle className="h-6 w-6 text-red-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-2xl font-bold text-brand-navy">{criticalCount}</p>
                <p className="text-sm text-muted-foreground">Critical Issues</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardWatermark opacity={2} scale={0.8} />
            <CardContent className="relative z-10 flex items-center gap-4 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
                <Icons.alertTriangle className="h-6 w-6 text-amber-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-2xl font-bold text-brand-navy">{warningCount}</p>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Insights */}
      <motion.div variants={itemVariants}>
        <Card className="relative overflow-hidden">
          <CardWatermark opacity={2} scale={1} />
          <CardHeader className="relative z-10">
            <CardTitle>Invoice Insights</CardTitle>
            <CardDescription>
              {hasRun
                ? `${insights.length} insight${insights.length === 1 ? '' : 's'} generated from your invoice data.`
                : 'Run an analysis to scan your invoices for anomalies and risks.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 space-y-4">
            <AnimatePresence mode="wait">
              {isAnalyzing ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <Icons.loader className="h-8 w-8 animate-spin text-brand-cornflower" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Scanning invoices and generating insights — this can take up to a minute.
                  </p>
                </motion.div>
              ) : error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  <Icons.alertCircle className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Analysis failed</p>
                    <p className="mt-0.5">{error}</p>
                  </div>
                </motion.div>
              ) : !hasRun ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className={cn(
                    'mb-4 flex h-16 w-16 items-center justify-center rounded-2xl',
                    'bg-gradient-to-br from-brand-cornflower/20 to-brand-purple/20'
                  )}>
                    <Icons.lightbulb className="h-8 w-8 text-brand-cornflower" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-brand-navy">
                    No insights yet
                  </h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Run an analysis to discover anomalies and recommendations from your invoice data.
                  </p>
                  <Button
                    variant="gradient"
                    className="mt-6"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                  >
                    <Icons.sparkles className="mr-2 h-4 w-4" strokeWidth={1.5} />
                    Generate Insights
                  </Button>
                </motion.div>
              ) : insights.length === 0 ? (
                <motion.div
                  key="none-found"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <Icons.checkCircle className="h-8 w-8 text-emerald-500" strokeWidth={1.5} />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No issues found in your invoice data.
                  </p>
                </motion.div>
              ) : (
                <motion.div key="results" className="space-y-4">
                  {insights.map((insight, idx) => (
                    <InsightCard key={idx} insight={insight} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
