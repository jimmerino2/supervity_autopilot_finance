'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api-client'
import { postSSE } from '@/lib/sse-stream'
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

interface LogEntry {
  id: string
  text: string
}

export default function AIInsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [isLoadingInitial, setIsLoadingInitial] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadInsights = useCallback(async () => {
    const data = await apiClient.get<Insight[]>('/api/insights')
    setInsights(data)
  }, [])

  useEffect(() => {
    loadInsights()
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load insights'))
      .finally(() => setIsLoadingInitial(false))
  }, [loadInsights])

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true)
    setError(null)
    setLogEntries([])

    let entryCount = 0
    const pushEntry = (text: string) => {
      entryCount += 1
      setLogEntries((prev) => [...prev, { id: `${Date.now()}-${entryCount}`, text }])
    }

    try {
      await postSSE('/api/insights/generate/stream', (event, data) => {
        switch (event) {
          case 'ping':
            return
          case 'error': {
            const payload = data as { error?: string; content?: string }
            setError(payload?.error || payload?.content || 'Unable to generate insights')
            return
          }
          case 'thinking': {
            const content = (data as { content?: string })?.content
            if (content) pushEntry(content)
            return
          }
          case 'activity-run': {
            const c = (data as { content?: { stepName?: string; status?: string } })?.content
            if (c?.stepName) pushEntry(`${c.stepName} — ${c.status}`)
            return
          }
          case 'workflow-run': {
            const c = (data as { content?: { status?: string } })?.content
            if (c?.status) pushEntry(`Workflow ${c.status}`)
            return
          }
          default:
            return
        }
      })
      // Insights are persisted server-side as they're generated — the DB is
      // the source of truth, so refetch rather than trusting the stream directly.
      await loadInsights()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate insights')
    } finally {
      setIsAnalyzing(false)
    }
  }, [loadInsights])

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
      {!isLoadingInitial && insights.length > 0 && (
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

      {/* Live run log */}
      {isAnalyzing && (
        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden">
            <CardWatermark opacity={2} scale={1} />
            <CardHeader className="relative z-10">
              <CardTitle className="flex items-center gap-2">
                <Icons.activity className="h-5 w-5 text-brand-cornflower" />
                Run Progress
              </CardTitle>
              <CardDescription>Live steps streamed from the insights workflow.</CardDescription>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/20 p-4">
                {logEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Starting...</p>
                ) : (
                  logEntries.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-cornflower" />
                      <span className="text-muted-foreground">{entry.text}</span>
                    </div>
                  ))
                )}
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
              {insights.length > 0
                ? `${insights.length} insight${insights.length === 1 ? '' : 's'} recorded.`
                : 'Run an analysis to scan your invoices for anomalies and risks.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 space-y-4">
            <AnimatePresence mode="wait">
              {isLoadingInitial ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <Icons.loader className="h-8 w-8 animate-spin text-brand-cornflower" />
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
              ) : insights.length === 0 ? (
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
              ) : (
                <motion.div key="results" className="space-y-4">
                  {insights.map((insight) => (
                    <InsightCard key={insight.id} insight={insight} />
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
