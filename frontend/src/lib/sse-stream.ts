import { getSession } from 'next-auth/react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''

/**
 * POST to a backend SSE endpoint and stream parsed {event, data} pairs to a
 * callback. Bypasses apiClient (which always calls response.json()) for a
 * raw fetch + manual line parse — SSE responses aren't JSON.
 *
 * `body`, when provided, is sent as JSON — used to override/add per-call
 * workflow inputs (e.g. invoice_doc_no/new_status for a single review
 * decision) on top of an orchestrator's static configured inputs.
 */
export async function postSSE(
  path: string,
  onEvent: (event: string, data: unknown) => void,
  body?: unknown
): Promise<void> {
  const session = await getSession()
  const headers = new Headers()
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`)
  if (session?.user?.email) headers.set('X-Approver-Email', session.user.email)
  if (body !== undefined) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${API_URL}${BASE_PATH}${path}`, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => response.statusText)
    throw new Error(errorText || 'Request failed')
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
        let data: unknown = null
        try {
          data = JSON.parse(line.slice(6))
        } catch {
          continue
        }
        onEvent(currentEvent, data)
      }
    }
  }
}
