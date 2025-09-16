"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Edit, Trash2, User } from "lucide-react"
import type { Comment } from "@/lib/project"

interface CommentItemProps {
  comment: Comment
  onEdit?: (id: string, content: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export function CommentItem({ comment, onEdit, onDelete }: CommentItemProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(comment.content)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Format date to readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleEdit = async () => {
    if (!onEdit || editedContent.trim() === comment.content) {
      setIsEditing(false)
      return
    }

    setIsSubmitting(true)
    try {
      await onEdit(comment.id, editedContent)
      setIsEditing(false)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return

    setIsSubmitting(true)
    try {
      await onDelete(comment.id)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex space-x-4">
      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
        <User className="h-5 w-5 text-gray-500" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium">{comment.createdBy || "Unknown User"}</span>
            <span className="text-xs text-gray-500 ml-2">{formatDate(comment.createdAt)}</span>
          </div>
          {(onEdit || onDelete) && (
            <div className="relative">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {isMenuOpen && (
                <div className="absolute right-0 mt-1 w-36 bg-white rounded-md shadow-lg overflow-hidden z-10 border">
                  {onEdit && (
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      onClick={() => {
                        setIsEditing(true)
                        setIsMenuOpen(false)
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {isEditing ? (
          <div className="mt-2">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              disabled={isSubmitting}
            />
            <div className="mt-2 flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false)
                  setEditedContent(comment.content)
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleEdit} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-gray-700">{comment.content}</p>
        )}
      </div>
    </div>
  )
}
