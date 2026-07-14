// Pipeline WebSocket mini-service — Architecture Élite v2
// Port fixe : 3003 (socket.io, path '/' pour règle Caddy)
// Port auxiliaire : 3004 (HTTP interne pour /emit — pas exposé via Caddy,
//                    uniquement pour les appels server-side depuis Next.js).
//
// Rooms : batch:<batch_id>
// Events :
//   client → server : 'subscribe' { batch_id }
//                    'pipeline:emit' { batch_id, event }  (alternative socket)
//   server → client : 'pipeline:event' (PipelineEvent)
//   HTTP POST :3004/emit : { batch_id, event }  → broadcast vers la room

import { createServer, IncomingMessage } from 'http'
import { Server, Socket } from 'socket.io'

interface PipelineEventPayload {
  batch_id: string
  sequence_id?: string | null
  agent: 'planificateur' | 'knowledge_compiler' | 'redacteur' | 'critique' | 'superviseur'
  skill?: string | null
  phase: 'start' | 'progress' | 'done' | 'error' | 'retry' | 'escalade'
  message: string
  payload?: Record<string, unknown>
  timestamp: string
  duration_ms?: number | null
}

const WS_PORT = 3003
const HTTP_PORT = 3004

// ============================================================
// 1. WebSocket server (port 3003, path '/' — règle Caddy)
// ============================================================
const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

const roomsSubscribers = new Map<string, Set<string>>()

io.on('connection', (socket: Socket) => {
  console.log(`[pipeline-service] client connected: ${socket.id}`)

  socket.on('subscribe', (data: { batch_id?: string }) => {
    const batchId = data?.batch_id
    if (!batchId) {
      socket.emit('error', { message: 'missing batch_id' })
      return
    }
    const roomName = `batch:${batchId}`
    socket.join(roomName)
    if (!roomsSubscribers.has(roomName)) roomsSubscribers.set(roomName, new Set())
    roomsSubscribers.get(roomName)!.add(socket.id)
    socket.emit('subscribed', { batch_id: batchId, room: roomName })
    console.log(`[pipeline-service] ${socket.id} subscribed to ${roomName}`)
  })

  socket.on('unsubscribe', (data: { batch_id?: string }) => {
    const batchId = data?.batch_id
    if (!batchId) return
    const roomName = `batch:${batchId}`
    socket.leave(roomName)
    roomsSubscribers.get(roomName)?.delete(socket.id)
  })

  // Alternative socket : le client peut aussi émettre pipeline:emit (utile pour tests)
  socket.on('pipeline:emit', (data: { batch_id?: string; event?: PipelineEventPayload }) => {
    const batchId = data?.batch_id
    const evt = data?.event
    if (!batchId || !evt) {
      socket.emit('error', { message: 'missing batch_id or event' })
      return
    }
    io.to(`batch:${batchId}`).emit('pipeline:event', evt)
  })

  socket.on('disconnect', () => {
    for (const [room, set] of roomsSubscribers.entries()) {
      set.delete(socket.id)
      if (set.size === 0) roomsSubscribers.delete(room)
    }
    console.log(`[pipeline-service] client disconnected: ${socket.id}`)
  })

  socket.on('error', (err: Error) => {
    console.error(`[pipeline-service] socket error (${socket.id}):`, err.message)
  })
})

httpServer.listen(WS_PORT, () => {
  console.log(`[pipeline-service] WebSocket server running on port ${WS_PORT} (path: /)`)
})

// ============================================================
// 2. HTTP auxiliaire (port 3004) — POST /emit + GET /health
//    Utilisé par l'orchestrateur Next.js pour émettre des pipeline:event
//    sans dépendre du client socket.io.
// ============================================================
const emitServer = createServer((req: IncomingMessage, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/emit') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}')
        const batchId: string | undefined = parsed?.batch_id
        const evt: PipelineEventPayload | undefined = parsed?.event
        if (!batchId || !evt) {
          res.writeHead(400)
          res.end(JSON.stringify({ ok: false, error: 'missing batch_id or event' }))
          return
        }
        io.to(`batch:${batchId}`).emit('pipeline:event', evt)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, batch_id: batchId, subscribers: roomsSubscribers.get(`batch:${batchId}`)?.size ?? 0 }))
      } catch (e) {
        res.writeHead(400)
        res.end(JSON.stringify({ ok: false, error: 'invalid JSON' }))
      }
    })
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      ws_port: WS_PORT,
      http_port: HTTP_PORT,
      service: 'pipeline-service',
      rooms: Array.from(roomsSubscribers.keys()),
      uptime: process.uptime(),
    }))
    return
  }

  res.writeHead(404)
  res.end(JSON.stringify({ error: 'not found' }))
})

emitServer.listen(HTTP_PORT, '127.0.0.1', () => {
  console.log(`[pipeline-service] HTTP emit server running on port ${HTTP_PORT} (POST /emit, GET /health)`)
})

// ============================================================
// Graceful shutdown
// ============================================================
process.on('SIGTERM', () => {
  console.log('[pipeline-service] SIGTERM received, shutting down...')
  httpServer.close()
  emitServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('[pipeline-service] SIGINT received, shutting down...')
  httpServer.close()
  emitServer.close(() => process.exit(0))
})
