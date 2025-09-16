"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useSocketRoom, useSocketEvent, useSocketEmit } from "@/lib/socket"
import { LiveCursor } from "@/components/collaboration/live-cursor"
import { PresenceIndicator } from "@/components/collaboration/presence-indicator"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { useUser } from "@/lib/state/store"
import { Loader2, Save } from "lucide-react"

interface CollaborativeEditorProps {
  roomId: string
  initialContent?: string
  onSave?: (content: string) => Promise<void>
  readOnly?: boolean
  placeholder?: string
  className?: string
}

export function CollaborativeEditor({
  roomId,
  initialContent = "",
  onSave,
  readOnly = false,
  placeholder = "Start typing...",
  className = "",
}: CollaborativeEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { emitEvent } = useSocketEmit()
  const { toast } = useToast()
  const user = useUser()

  // Join the room
  useSocketRoom(roomId)

  // Listen for content updates
  useSocketEvent<{ content: string; userId: string }>("content_update", (data) => {
    // Only update if it's from another user
    if (data.userId !== user?.id) {
      setContent(data.content)
    }
  })

  // Handle content change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)

    // Emit content update
    emitEvent("content_update", {
      roomId,
      content: newContent,
    })
  }

  // Handle save
  const handleSave = async () => {
    if (!onSave || readOnly) return

    try {
      setIsSaving(true)
      await onSave(content)
      setLastSavedAt(new Date())
      toast({
        title: "Saved",
        description: "Your changes have been saved.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={`relative border rounded-md ${className}`} ref={containerRef}>
      <div className="flex justify-between items-center p-2 border-b bg-muted/50">
        <PresenceIndicator roomId={roomId} />

        {onSave && !readOnly && (
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        )}
      </div>

      <Textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        placeholder={placeholder}
        className="min-h-[200px] border-0 focus-visible:ring-0 resize-y"
        readOnly={readOnly}
      />

      {lastSavedAt && (
        <div className="text-xs text-muted-foreground p-2 border-t">Last saved: {lastSavedAt.toLocaleString()}</div>
      )}

      <LiveCursor roomId={roomId} containerRef={containerRef} />
    </div>
  )
}
