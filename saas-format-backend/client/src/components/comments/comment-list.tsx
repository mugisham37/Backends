"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getComments, createComment } from "@/lib/project"
import { toast } from "react-hot-toast"
import { Send } from "lucide-react"
import { CommentItem } from "./comment-item"
import type { Comment } from "@/lib/project"

interface CommentListProps {
  projectId: string
  taskId: string
}

export function CommentList({ projectId, taskId }: CommentListProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const data = await getComments(projectId, taskId)
        setComments(data)
      } catch (error) {
        toast.error("Failed to load comments")
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchComments()
  }, [projectId, taskId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setIsSubmitting(true)
    try {
      const comment = await createComment(projectId, taskId, { content: newComment })
      setComments([...comments, comment])
      setNewComment("")
      toast.success("Comment added successfully")
    } catch (error) {
      toast.error("Failed to add comment")
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex space-x-4">
                <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {comments.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No comments yet. Be the first to comment!</p>
        ) : (
          <div className="space-y-6">
            {comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              {/* This would be the user's avatar */}
            </div>
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                disabled={isSubmitting}
              />
              <div className="mt-2 flex justify-end">
                <Button type="submit" disabled={isSubmitting || !newComment.trim()}>
                  {isSubmitting ? (
                    "Posting..."
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Post Comment
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
