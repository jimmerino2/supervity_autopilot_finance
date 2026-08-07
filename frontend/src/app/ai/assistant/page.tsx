'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, getSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/ui/icons'
import { ChatMessage } from '@/components/ai/ChatMessage'
import { ChatInput } from '@/components/ai/ChatInput'
import type { ChatMessage as DisplayMessage } from '@/context/AIContext'

// ============================================================================
// Types — mirrors docs.supervity.ai/api-docs/chats
// ============================================================================

interface ThreadSummary {
  id: string
  title: string | null
  lastUpdatedAt: string
}

interface RemoteMessage {
  id: string
  role: 'user' | 'assistant'
  type: string
  content: string
  createdAt: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

/** Supervity appends a machine-readable suggestion block to some replies — strip it for display. */
function stripQuickReplies(text: string): string {
  return text.replace(/<quick_replies>[\s\S]*?<\/quick_replies>/g, '').trimEnd()
}

function toDisplayMessage(m: RemoteMessage): DisplayMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.role === 'assistant' ? stripQuickReplies(m.content) : m.content,
    timestamp: new Date(m.createdAt),
  }
}

/**
 * POST /api/supervity/chats/:threadId/messages streams SSE. apiClient always
 * awaits response.json(), so this bypasses it for a raw fetch + manual parse —
 * the same line-by-line approach docs.supervity.ai's own example uses.
 */
async function streamChatMessage(
  threadId: string,
  message: string,
  onDelta: (text: string) => void
): Promise<void> {
  const session = await getSession()
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`)
  if (session?.user?.email) headers.set('X-Approver-Email', session.user.email)

  const response = await fetch(`${API_URL}${BASE_PATH}/api/supervity/chats/${threadId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  })

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => response.statusText)
    throw new Error(errorText || 'Failed to send message')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = 'message'

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        let data: { content?: string } = {}
        try {
          data = JSON.parse(line.slice(6))
        } catch {
          continue
        }
        if (currentEvent === 'error') {
          throw new Error(data.content || 'Streaming error')
        }
        if (currentEvent === 'message' && data.content) {
          onDelta(data.content)
        }
      }
    }
  }
}

// ============================================================================
// Animation
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

// ============================================================================
// Page
// ============================================================================

export default function AIAssistantPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [isLoadingThreads, setIsLoadingThreads] = useState(true)
  const [threadsError, setThreadsError] = useState<string | null>(null)

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isAdmin = session?.roles?.includes('admin')

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    if (!isAdmin) {
      router.push('/')
      return
    }
    loadThreads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isAdmin, router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadThreads = useCallback(async () => {
    setIsLoadingThreads(true)
    setThreadsError(null)
    try {
      const data = await apiClient.get<{ threads: ThreadSummary[] }>('/api/supervity/chats')
      setThreads(data.threads)
    } catch (err) {
      setThreadsError(err instanceof Error ? err.message : 'Unable to load chat threads')
    } finally {
      setIsLoadingThreads(false)
    }
  }, [])

  const selectThread = useCallback(async (threadId: string) => {
    setSelectedThreadId(threadId)
    setIsLoadingMessages(true)
    setSendError(null)
    try {
      const data = await apiClient.get<{ messages: RemoteMessage[] }>(
        `/api/supervity/chats/${threadId}/messages`
      )
      setMessages(data.messages.map(toDisplayMessage))
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Unable to load messages')
      setMessages([])
    } finally {
      setIsLoadingMessages(false)
    }
  }, [])

  const startNewThread = useCallback(async () => {
    setThreadsError(null)
    try {
      const data = await apiClient.post<{ threadId: string }>('/api/supervity/chats')
      setMessages([])
      setSelectedThreadId(data.threadId)
      await loadThreads()
    } catch (err) {
      setThreadsError(err instanceof Error ? err.message : 'Unable to start a new chat')
    }
  }, [loadThreads])

  const deleteThread = useCallback(
    async (threadId: string, event: React.MouseEvent) => {
      event.stopPropagation()
      try {
        await apiClient.delete(`/api/supervity/chats/${threadId}`)
        if (selectedThreadId === threadId) {
          setSelectedThreadId(null)
          setMessages([])
        }
        await loadThreads()
      } catch (err) {
        setThreadsError(err instanceof Error ? err.message : 'Unable to delete chat')
      }
    },
    [selectedThreadId, loadThreads]
  )

  const handleSend = useCallback(
    async (text: string) => {
      let threadId = selectedThreadId

      // No thread selected yet — create one on first message.
      if (!threadId) {
        try {
          const data = await apiClient.post<{ threadId: string }>('/api/supervity/chats')
          threadId = data.threadId
          setSelectedThreadId(threadId)
          loadThreads()
        } catch (err) {
          setSendError(err instanceof Error ? err.message : 'Unable to start a new chat')
          return
        }
      }

      const userMessage: DisplayMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date(),
      }
      const assistantMessageId = `local-${Date.now()}-assistant`
      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantMessageId, role: 'assistant', content: '', timestamp: new Date(), isLoading: true },
      ])
      setIsSending(true)
      setSendError(null)

      let accumulated = ''
      try {
        await streamChatMessage(threadId, text, (delta) => {
          accumulated += delta
          const displayText = stripQuickReplies(accumulated)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, content: displayText, isLoading: false } : m
            )
          )
        })
      } catch (err) {
        setSendError(err instanceof Error ? err.message : 'Failed to get a response')
        setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId))
      } finally {
        setIsSending(false)
        loadThreads()
      }
    },
    [selectedThreadId, loadThreads]
  )

  const formatRelativeDate = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime()
    const diffMin = Math.round(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.round(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    return `${Math.round(diffHr / 24)}d ago`
  }

  return (
    <motion.div className='flex h-[calc(100vh-7rem)] flex-col space-y-4' variants={containerVariants} initial='hidden' animate='visible'>
      <motion.div variants={itemVariants}>
        <p className='text-sm uppercase tracking-[0.2em] text-brand-cornflower'>AI Intelligence</p>
        <h1 className='text-display-4 font-bold text-brand-navy'>AI Assistant</h1>
      </motion.div>

      <motion.div variants={itemVariants} className='flex min-h-0 flex-1 gap-4'>
        {/* Thread list */}
        <div className='flex w-72 flex-shrink-0 flex-col rounded-2xl border border-border bg-white shadow-sm'>
          <div className='border-b border-border p-3'>
            <Button onClick={startNewThread} className='w-full gap-2' size='sm'>
              <Icons.plus className='h-4 w-4' />
              New Chat
            </Button>
          </div>
          <div className='flex-1 overflow-y-auto p-2'>
            {isLoadingThreads ? (
              <div className='flex items-center justify-center py-10'>
                <Icons.loader className='h-5 w-5 animate-spin text-brand-cornflower' />
              </div>
            ) : threadsError ? (
              <p className='p-3 text-xs text-red-600'>{threadsError}</p>
            ) : threads.length === 0 ? (
              <p className='p-3 text-center text-xs text-muted-foreground'>No chats yet — start one above.</p>
            ) : (
              <div className='space-y-1'>
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => selectThread(thread.id)}
                    className={cn(
                      'group flex w-full items-start justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors',
                      selectedThreadId === thread.id ? 'bg-brand-navy text-white' : 'hover:bg-muted/60'
                    )}
                  >
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm font-medium'>{thread.title || 'Untitled chat'}</p>
                      <p
                        className={cn(
                          'mt-0.5 text-xs',
                          selectedThreadId === thread.id ? 'text-white/70' : 'text-muted-foreground'
                        )}
                      >
                        {formatRelativeDate(thread.lastUpdatedAt)}
                      </p>
                    </div>
                    <span
                      role='button'
                      tabIndex={0}
                      onClick={(e) => deleteThread(thread.id, e)}
                      className={cn(
                        'flex-shrink-0 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100',
                        selectedThreadId === thread.id ? 'hover:bg-white/20' : 'hover:bg-red-100 hover:text-red-600'
                      )}
                      title='Delete chat'
                    >
                      <Icons.trash className='h-3.5 w-3.5' />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className='flex min-w-0 flex-1 flex-col rounded-2xl border border-border bg-white shadow-sm'>
          {!selectedThreadId && messages.length === 0 ? (
            <div className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
              <div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-navy to-brand-purple'>
                <Icons.sparkles className='h-7 w-7 text-white' strokeWidth={1.5} />
              </div>
              <div>
                <p className='font-display text-lg font-semibold text-brand-navy'>Ask the AI Assistant</p>
                <p className='mt-1 max-w-sm text-sm text-muted-foreground'>
                  Powered by Supervity — send a message below to start a new chat.
                </p>
              </div>
            </div>
          ) : (
            <div className='flex-1 space-y-4 overflow-y-auto p-5'>
              {isLoadingMessages ? (
                <div className='flex items-center justify-center py-10'>
                  <Icons.loader className='h-5 w-5 animate-spin text-brand-cornflower' />
                </div>
              ) : (
                messages.map((message) => (
                  <ChatMessage key={message.id} message={message} userName={session?.user?.name || undefined} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {sendError && (
            <div className='mx-4 mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700'>
              <Icons.alertCircle className='h-3.5 w-3.5 flex-shrink-0' />
              {sendError}
            </div>
          )}

          <div className='border-t border-border'>
            <ChatInput onSend={handleSend} disabled={isSending} placeholder='Message the AI Assistant...' />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
