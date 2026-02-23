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
  const error = ref<string | null>(null)
  let eventSource: EventSource | null = null
  let hasCompleted = false  // Track if we received a completion event

  const connect = (url: string, eventHandlers: Record<string, (data: any) => void>) => {
    disconnect() // Close any existing connection
    error.value = null
    hasCompleted = false

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

        // Add to logs (skip heartbeat events to reduce noise)
        if (eventType !== 'heartbeat') {
          logs.value.push({
            timestamp: new Date().toLocaleTimeString('de-DE'),
            event: eventType,
            message: data.message,
            data
          })
        }

        // Track completion events
        if (eventType.includes('complete') || eventType.includes('error')) {
          hasCompleted = true
        }

        // Call custom handler
        eventHandlers[eventType](data)
      })
    })

    eventSource.onerror = (err) => {
      console.error('SSE error:', err)

      // Delay to allow any buffered SSE events (e.g. write_complete) to be processed
      // before deciding whether this is a real error. The browser can queue onerror at
      // the same time as the final event when the server closes the connection.
      setTimeout(() => {
        // Only treat as error if we haven't already completed successfully
        // EventSource fires onerror when connection closes, even after successful completion
        if (!hasCompleted && isConnected.value) {
          const errorMessage = 'SSE connection error: The connection to the server was lost or timed out. The operation may have been interrupted.'
          error.value = errorMessage

          // Add error to logs
          logs.value.push({
            timestamp: new Date().toLocaleTimeString('de-DE'),
            event: 'error',
            message: errorMessage,
            data: err
          })
        }

        isLoading.value = false
        disconnect()
      }, 300)
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

  const clearError = () => {
    error.value = null
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    logs,
    isConnected,
    isLoading,
    error,
    connect,
    disconnect,
    clearLogs,
    clearError
  }
}
