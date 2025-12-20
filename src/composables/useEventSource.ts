import { ref, onUnmounted } from 'vue'

export interface SSELogEntry {
  timestamp: string
  event: string
  message: string
  data?: any
}

export function useEventSource() {
  const logs = ref<SSELogEntry[]>([])
  const isConnected = ref(false)
  const isLoading = ref(false)
  let eventSource: EventSource | null = null

  const connect = (url: string, eventHandlers: Record<string, (data: any) => void>) => {
    disconnect() // Close any existing connection

    eventSource = new EventSource(url)
    isConnected.value = true
    isLoading.value = true

    // Generic message handler for logging
    eventSource.onmessage = (event) => {
      console.log('SSE message:', event)
    }

    // Register custom event handlers
    Object.keys(eventHandlers).forEach(eventType => {
      eventSource!.addEventListener(eventType, (event: Event) => {
        const messageEvent = event as MessageEvent
        const data = JSON.parse(messageEvent.data)

        // Add to logs
        logs.value.push({
          timestamp: new Date().toLocaleTimeString('de-DE'),
          event: eventType,
          message: data.message,
          data
        })

        // Call custom handler
        eventHandlers[eventType](data)
      })
    })

    eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      isLoading.value = false
      disconnect()
    }
  }

  const disconnect = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
      isConnected.value = false
      isLoading.value = false
    }
  }

  const clearLogs = () => {
    logs.value = []
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    logs,
    isConnected,
    isLoading,
    connect,
    disconnect,
    clearLogs
  }
}
