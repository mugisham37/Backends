"use client"

import { io, type Socket } from "socket.io-client"
import { useEffect, useState } from "react"
import { useAppStore, useTenant } from "@/lib/state/store"
import { trackError } from "@/lib/analytics"

// Socket.io client instance
let socket: Socket | null = null

// Socket connection options
const socketOptions = {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  autoConnect: false,
  withCredentials: true,
}

/**
 * Initialize the Socket.io connection
 * @param token JWT token for authentication
 * @param tenantId Current tenant ID
 * @returns Socket.io client instance
 */
export const initializeSocket = (token: string, tenantId: string | null): Socket => {
  if (socket) {
    return socket
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
  const socketUrl = `${apiUrl}/socket`

  socket = io(socketUrl, {
    ...socketOptions,
    auth: {
      token,
      tenantId,
    },
  })

  // Connection event handlers
  socket.on("connect", () => {
    console.log("Socket connected:", socket?.id)
  })

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error)
    trackError("socket_connection_error", error.message)
  })

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason)

    // Attempt to reconnect if the disconnection was not intentional
    if (reason === "io server disconnect") {
      socket?.connect()
    }
  })

  socket.on("reconnect_attempt", (attemptNumber) => {
    console.log(`Socket reconnection attempt ${attemptNumber}`)
  })

  socket.on("reconnect_failed", () => {
    console.error("Socket reconnection failed")
    trackError("socket_reconnection_failed", "Maximum reconnection attempts reached")
  })

  // Connect the socket
  socket.connect()

  return socket
}

/**
 * Disconnect the Socket.io connection
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

/**
 * Get the current Socket.io instance
 * @returns Socket.io client instance or null if not initialized
 */
export const getSocket = (): Socket | null => {
  return socket
}

/**
 * React hook to use the Socket.io connection
 * @returns Socket.io client instance and connection status
 */
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const { user, isAuthenticated } = useAppStore((state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
  }))
  const { tenantId } = useTenant()

  useEffect(() => {
    // Initialize socket when authenticated
    if (isAuthenticated && user?.token && tenantId) {
      const socketInstance = initializeSocket(user.token, tenantId)

      // Update connection status
      const handleConnect = () => setIsConnected(true)
      const handleDisconnect = () => setIsConnected(false)

      socketInstance.on("connect", handleConnect)
      socketInstance.on("disconnect", handleDisconnect)

      // Set initial connection status
      setIsConnected(socketInstance.connected)

      return () => {
        socketInstance.off("connect", handleConnect)
        socketInstance.off("disconnect", handleDisconnect)
      }
    }

    return undefined
  }, [isAuthenticated, user?.token, tenantId])

  return { socket: getSocket(), isConnected }
}

/**
 * React hook to subscribe to a Socket.io event
 * @param event Event name to subscribe to
 * @param callback Callback function to handle the event
 */
export const useSocketEvent = <T = any>(event: string, callback: (data: T) => void) => {
  const { socket } = useSocket()

  useEffect(() => {
    if (!socket) return

    // Add event listener
    socket.on(event, callback)

    // Remove event listener on cleanup
    return () => {
      socket.off(event, callback)
    }
  }, [socket, event, callback])
}

/**
 * React hook to emit a Socket.io event
 * @returns Function to emit an event
 */
export const useSocketEmit = () => {
  const { socket, isConnected } = useSocket()

  const emitEvent = <T = any>(event: string, data: T, callback?: (response: any) => void): boolean => {
    if (!socket || !isConnected) {
      console.warn(`Cannot emit ${event}: Socket not connected`)
      return false
    }

    socket.emit(event, data, callback)
    return true
  }

  return { emitEvent, isConnected }
}

/**
 * React hook to join a Socket.io room
 * @param room Room name to join
 */
export const useSocketRoom = (room: string) => {
  const { socket, isConnected } = useSocket()

  useEffect(() => {
    if (!socket || !isConnected || !room) return

    // Join room
    socket.emit("join_room", { room })

    // Leave room on cleanup
    return () => {
      socket.emit("leave_room", { room })
    }
  }, [socket, isConnected, room])
}

/**
 * React hook to track user presence
 * @param userId User ID to track presence for
 * @returns Object containing online status and last seen timestamp
 */
export const useUserPresence = (userId: string) => {
  const [isOnline, setIsOnline] = useState<boolean>(false)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const { socket } = useSocket()

  useEffect(() => {
    if (!socket || !userId) return

    // Request user presence
    socket.emit("get_user_presence", { userId }, (response: { isOnline: boolean; lastSeen: string | null }) => {
      setIsOnline(response.isOnline)
      setLastSeen(response.lastSeen)
    })

    // Listen for presence updates
    const handlePresenceUpdate = (data: { userId: string; isOnline: boolean; lastSeen: string | null }) => {
      if (data.userId === userId) {
        setIsOnline(data.isOnline)
        setLastSeen(data.lastSeen)
      }
    }

    socket.on("presence_update", handlePresenceUpdate)

    // Remove event listener on cleanup
    return () => {
      socket.off("presence_update", handlePresenceUpdate)
    }
  }, [socket, userId])

  return { isOnline, lastSeen }
}

/**
 * React hook to broadcast user presence
 */
export const useBroadcastPresence = () => {
  const { socket, isConnected } = useSocket()
  const { user } = useAppStore((state) => ({ user: state.user }))

  useEffect(() => {
    if (!socket || !isConnected || !user) return

    // Set initial presence
    socket.emit("set_presence", { isOnline: true })

    // Set up interval to refresh presence
    const interval = setInterval(() => {
      socket.emit("heartbeat")
    }, 30000) // Every 30 seconds

    // Set up window events to track user activity
    const handleVisibilityChange = () => {
      socket.emit("set_presence", { isOnline: document.visibilityState === "visible" })
    }

    const handleBeforeUnload = () => {
      socket.emit("set_presence", { isOnline: false })
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("beforeunload", handleBeforeUnload)

    // Clean up
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      socket.emit("set_presence", { isOnline: false })
    }
  }, [socket, isConnected, user])
}
