"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useSocketRoom, useSocketEvent, useSocketEmit } from "@/lib/socket"
import { throttle } from "lodash"

interface Cursor {
  userId: string
  userName: string
  x: number
  y: number
  color: string
  timestamp: number
}

interface LiveCursorProps {
  roomId: string
  containerRef: React.RefObject<HTMLElement>
  cursorTimeout?: number
}

export function LiveCursor({ roomId, containerRef, cursorTimeout = 5000 }: LiveCursorProps) {
  const [cursors, setCursors] = useState<Record<string, Cursor>>({})
  const { emitEvent } = useSocketEmit()

  // Join the room
  useSocketRoom(roomId)

  // Listen for cursor updates
  useSocketEvent<Cursor>("cursor_move", (cursor) => {
    setCursors((prev) => ({
      ...prev,
      [cursor.userId]: cursor,
    }))
  })

  // Remove cursors after timeout
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setCursors((prev) => {
        const updated = { ...prev }
        Object.keys(updated).forEach((userId) => {
          if (now - updated[userId].timestamp > cursorTimeout) {
            delete updated[userId]
          }
        })
        return updated
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [cursorTimeout])

  // Track mouse movement
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    // Throttle mouse move events to reduce network traffic
    const handleMouseMove = throttle((e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height

      // Emit cursor position as percentage of container
      emitEvent("cursor_move", {
        roomId,
        x,
        y,
        timestamp: Date.now(),
      })
    }, 50)

    container.addEventListener("mousemove", handleMouseMove)

    return () => {
      container.removeEventListener("mousemove", handleMouseMove)
      handleMouseMove.cancel()
    }
  }, [containerRef, roomId, emitEvent])

  // Render cursors
  return (
    <>
      {Object.values(cursors).map((cursor) => (
        <div
          key={cursor.userId}
          className="absolute pointer-events-none"
          style={{
            left: `${cursor.x * 100}%`,
            top: `${cursor.y * 100}%`,
            transform: "translate(-50%, -50%)",
            zIndex: 9999,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ color: cursor.color }}
          >
            <path
              d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.0579834 17.2976L0.0636793 17.3047L0.046439 17.3224C-0.0757779 17.4522 -0.0163025 17.6697 0.164488 17.7263L0.176487 17.7293L0.188236 17.7321C0.236236 17.7444 0.283985 17.75 0.331984 17.75C0.446232 17.75 0.559981 17.7007 0.638979 17.6047L0.647728 17.5939L0.655978 17.5829L4.69026 12.0829L4.81026 11.9273V11.75V7.25V7.07269L4.69026 6.91709L0.655978 1.41709L0.647728 1.40606L0.638979 1.39533C0.559981 1.29933 0.446232 1.25 0.331984 1.25C0.283985 1.25 0.236236 1.25559 0.188236 1.26794L0.176487 1.27072L0.164488 1.27367C-0.0163025 1.33033 -0.0757779 1.54785 0.046439 1.67767L0.0636793 1.69533L0.0579834 1.70243L5.31717 6.50243L5.46026 6.63269H5.65376H23.25C23.6642 6.63269 24 6.9685 24 7.38269V11.75C24 12.1642 23.6642 12.3673 23.25 12.3673H5.65376Z"
              fill="currentColor"
              stroke="white"
              strokeWidth="0.5"
            />
          </svg>
          <div
            className="absolute left-4 top-0 px-2 py-1 rounded text-xs text-white whitespace-nowrap"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.userName}
          </div>
        </div>
      ))}
    </>
  )
}
