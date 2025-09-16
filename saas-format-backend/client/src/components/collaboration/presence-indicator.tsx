"use client"

import { useState } from "react"
import { useSocketRoom, useSocketEvent } from "@/lib/socket"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getInitials } from "@/lib/utils"

interface User {
  id: string
  name: string
  avatarUrl?: string
  lastActive?: string
  color?: string
}

interface PresenceIndicatorProps {
  roomId: string
  maxDisplayed?: number
  showCount?: boolean
}

export function PresenceIndicator({ roomId, maxDisplayed = 3, showCount = true }: PresenceIndicatorProps) {
  const [activeUsers, setActiveUsers] = useState<User[]>([])

  // Join the room
  useSocketRoom(roomId)

  // Listen for presence updates
  useSocketEvent<{ users: User[] }>("presence_update", (data) => {
    setActiveUsers(data.users)
  })

  // Get random color for user
  const getUserColor = (userId: string) => {
    const colors = [
      "#f97316", // orange
      "#8b5cf6", // violet
      "#06b6d4", // cyan
      "#22c55e", // green
      "#f43f5e", // rose
      "#3b82f6", // blue
      "#eab308", // yellow
    ]

    // Generate a consistent index based on user ID
    const charCodeSum = userId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)
    return colors[charCodeSum % colors.length]
  }

  // No users
  if (activeUsers.length === 0) {
    return null
  }

  // Display users
  const displayedUsers = activeUsers.slice(0, maxDisplayed)
  const remainingCount = activeUsers.length - maxDisplayed

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        <TooltipProvider>
          {displayedUsers.map((user) => (
            <Tooltip key={user.id}>
              <TooltipTrigger asChild>
                <Avatar className="h-8 w-8 border-2 border-background">
                  <AvatarImage src={user.avatarUrl || "/placeholder.svg"} alt={user.name} />
                  <AvatarFallback style={{ backgroundColor: user.color || getUserColor(user.id) }}>
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p>{user.name}</p>
                {user.lastActive && (
                  <p className="text-xs text-muted-foreground">
                    Active {new Date(user.lastActive).toLocaleTimeString()}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>

      {showCount && remainingCount > 0 && (
        <span className="ml-2 text-sm text-muted-foreground">
          +{remainingCount} {remainingCount === 1 ? "user" : "users"}
        </span>
      )}
    </div>
  )
}
