// Hook d'abonnement WebSocket à un batch de pipeline.
// Connexion: io("/?XTransformPort=3003") — Caddy forward vers le mini-service.
// On emit `subscribe {batch_id}` puis on écoute `pipeline:event`.

'use client'

import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { PipelineEvent } from '@/lib/types'

interface UsePipelineEventsOptions {
  batchId: string | null
  // Borne le journal à N entrées pour éviter une croissance infinie côté UI.
  maxEvents?: number
  // Callback optionnel sur chaque événement (ex: rafraîchir GET /api/pipeline/batch/[id])
  onEvent?: (ev: PipelineEvent) => void
}

interface PipelineEventsState {
  connected: boolean
  events: PipelineEvent[]
  clear: () => void
}

export function usePipelineEvents({
  batchId,
  maxEvents = 200,
  onEvent,
}: UsePipelineEventsOptions): PipelineEventsState {
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<PipelineEvent[]>([])
  const socketRef = useRef<Socket | null>(null)
  // Garde une référence stable du callback sans déclencher de re-subscribe.
  const onEventRef = useRef<typeof onEvent>(undefined)
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  // Reset du journal quand on change de batch — pattern React "derived state on prop change"
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  // On évite ainsi setState-in-effect qui déclencherait un re-render en cascade.
  const [prevBatchId, setPrevBatchId] = useState<string | null>(batchId)
  if (batchId !== prevBatchId) {
    setPrevBatchId(batchId)
    setEvents([])
  }

  useEffect(() => {
    if (!batchId) {
      // Pas de batch à suivre — on s'assure que le statut connecté est faux.
      // Initialisé à false dès le départ, mais on réinitialise aussi lors d'un passage
      // batch -> null. La socket précédente a été nettoyée par le cleanup ci-dessous
      // qui a déjà déclenché le listener 'disconnect'.
      return
    }

    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionAttempts: 10,
    })
    socketRef.current = socket

    const handleConnect = () => {
      setConnected(true)
      socket.emit('subscribe', { batch_id: batchId })
    }
    const handleDisconnect = () => setConnected(false)
    const handleConnectError = () => setConnected(false)
    const handlePipelineEvent = (ev: PipelineEvent) => {
      setEvents((prev) => {
        const next = [...prev, ev]
        if (next.length > maxEvents) next.splice(0, next.length - maxEvents)
        return next
      })
      onEventRef.current?.(ev)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('pipeline:event', handlePipelineEvent)

    return () => {
      socket.emit('unsubscribe', { batch_id: batchId })
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('pipeline:event', handlePipelineEvent)
      socket.disconnect()
      socketRef.current = null
      // setConnected(false) est déclenché par le listener 'disconnect' lors du disconnect()
    }
  }, [batchId, maxEvents])

  return {
    connected,
    events,
    clear: () => setEvents([]),
  }
}
