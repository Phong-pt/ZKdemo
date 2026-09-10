export interface RealtimeSession<T> {
  send: (event: T) => void
  close: () => void
}

export function connectSession<T>(sessionId: string, onMessage: (event: T) => void): RealtimeSession<T> {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${protocol}://${window.location.host}/api/session/${sessionId}/ws`)
  const queue: T[] = []

  ws.addEventListener('open', () => {
    while (queue.length > 0) {
      const event = queue.shift()
      if (event !== undefined) ws.send(JSON.stringify(event))
    }
  })

  ws.addEventListener('message', (e) => {
    try {
      onMessage(JSON.parse(e.data as string) as T)
    } catch {
      // ignore malformed messages
    }
  })

  return {
    send: (event: T) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event))
      } else {
        queue.push(event)
      }
    },
    close: () => ws.close(),
  }
}
