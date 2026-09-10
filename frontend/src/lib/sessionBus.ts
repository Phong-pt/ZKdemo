type Listener<T> = (event: T) => void

const channels = new Map<string, Set<Listener<unknown>>>()

export function publish<T>(sessionId: string, event: T): void {
  const listeners = channels.get(sessionId)
  if (!listeners) return
  for (const listener of listeners) listener(event)
}

export function subscribe<T>(sessionId: string, cb: Listener<T>): () => void {
  let listeners = channels.get(sessionId)
  if (!listeners) {
    listeners = new Set()
    channels.set(sessionId, listeners)
  }
  listeners.add(cb as Listener<unknown>)
  return () => {
    listeners.delete(cb as Listener<unknown>)
    if (listeners.size === 0) channels.delete(sessionId)
  }
}
