// Minimal, dependency-free SSE (text/event-stream) parser for use with fetch + ReadableStream, since
// EventSource can't send an Authorization header or a POST body. Feed it decoded text chunks as they
// arrive (chunks may split an event anywhere, including mid-line) and it buffers until full events —
// separated by a blank line — are available.

/**
 * @typedef {{ event: string, data: string }} SseEvent
 */

export class SseParser {
  constructor() {
    this.buffer = ''
  }

  /**
   * @param {string} chunkText a decoded slice of the response body
   * @returns {SseEvent[]} zero or more complete events extracted from the buffer so far
   */
  push(chunkText) {
    this.buffer += chunkText
    // Normalize newlines so \n\n / \r\n\r\n / \r\r all count as the same event separator.
    this.buffer = this.buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    const events = []
    let separatorIndex
    while ((separatorIndex = this.buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = this.buffer.slice(0, separatorIndex)
      this.buffer = this.buffer.slice(separatorIndex + 2)
      const parsed = parseEventBlock(rawEvent)
      if (parsed) events.push(parsed)
    }
    return events
  }
}

function parseEventBlock(rawEvent) {
  let eventName = 'message'
  const dataLines = []
  for (const line of rawEvent.split('\n')) {
    if (!line || line.startsWith(':')) continue // blank line / SSE comment (keep-alive)
    const colonIndex = line.indexOf(':')
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex)
    const value = colonIndex === -1 ? '' : line.slice(colonIndex + 1).replace(/^ /, '')
    if (field === 'event') {
      eventName = value
    } else if (field === 'data') {
      dataLines.push(value)
    }
  }
  if (dataLines.length === 0) return null
  return { event: eventName, data: dataLines.join('\n') }
}

/**
 * Parses SSE `data` as JSON. Returns null on failure instead of throwing, so one malformed event
 * never crashes the page — the caller just skips it and keeps listening for the next one.
 * @param {string} dataText
 */
export function parseSseJson(dataText) {
  try {
    return JSON.parse(dataText)
  } catch (error) {
    console.warn('[sse] failed to parse event data as JSON:', dataText, error)
    return null
  }
}
