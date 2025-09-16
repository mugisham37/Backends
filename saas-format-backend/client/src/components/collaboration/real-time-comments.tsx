"use client"

import type React from "react"

import { useState } from "react"
import { useSocketRoom, useSocketEvent, useSocketEmit } from "@/lib/socket"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { useUser } from "@/lib/state/store"
import { getInitials } from "@/lib/utils"
import { Send, Trash2 } from "lucide-react"

interface Comment {
  id: string
  content: string
  createdAt: string
  user: {
    id: string
    name: string
    avatarUrl?: string
  }
}

interface RealTimeCommentsProps {
  roomId: string
  onAddComment?: (content: string) => Promise<void>
  onDeleteComment?: (commentId: string) => Promise<void>
  className?: string
}

export function RealTimeComments({ roomId, onAddComment, onDeleteComment, className = "" }: RealTimeCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { emitEvent } = useSocketEmit()
  const { toast } = useToast()
  const user = useUser()

  // Join the room
  useSocketRoom(roomId)

  // Listen for comment updates
  useSocketEvent<{ comments: Comment[] }>("comments_update", (data) => {
    setComments(data.comments)
  })

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newComment.trim() || !user) return

    try {
      setIsSubmitting(true)

      // Add comment locally first for optimistic UI
      const tempComment: Comment = {
        id: `temp-${Date.now()}`,
        content: newComment,
        createdAt: new Date().toISOString(),
        user: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          avatarUrl: user.avatarUrl,
        },
      }

      setComments((prev) => [...prev, tempComment])

      // Emit comment to server
      emitEvent("add_comment", {
        roomId,
        content: newComment,
      })

      // Call onAddComment if provided
      if (onAddComment) {
        await onAddComment(newComment)
      }

      setNewComment("")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle delete
  const handleDelete = async (commentId: string) => {
    try {
      // Remove comment locally first for optimistic UI
      setComments((prev) => prev.filter((comment) => comment.id !== commentId))

      // Emit delete to server
      emitEvent("delete_comment", {
        roomId,
        commentId,
      })

      // Call onDeleteComment if provided
      if (onDeleteComment) {
        await onDeleteComment(commentId)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete comment. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className={`border rounded-md ${className}`}>
      <div className="p-3 border-b bg-muted/50">
        <h3 className="font-medium">Comments</h3>
      </div>

      <div className="p-4 max-h-[400px] overflow-y-auto space-y-4">
        {comments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No comments yet</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={comment.user.avatarUrl || "/placeholder.svg"} alt={comment.user.name} />
                <AvatarFallback>{getInitials(comment.user.name)}</AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{comment.user.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</p>
                  </div>

                  {user?.id === comment.user.id && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(comment.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <p className="mt-1 text-sm">{comment.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatarUrl || "/placeholder.svg"} alt={`${user?.firstName} ${user?.lastName}`} />
            <AvatarFallback>{getInitials(`${user?.firstName} ${user?.lastName}`)}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="resize-none"
              disabled={isSubmitting}
            />

            <div className="flex justify-end mt-2">
              <Button type="submit" disabled={isSubmitting || !newComment.trim()}>
                {isSubmitting ? (
                  "Sending..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
