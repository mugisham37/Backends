"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { getAttachments, uploadAttachment, deleteAttachment, downloadAttachment } from "@/lib/project"
import { toast } from "react-hot-toast"
import { Upload, ImageIcon } from "lucide-react"
import { AttachmentItem } from "./attachment-item"
import type { Attachment } from "@/lib/project"

interface AttachmentListProps {
  projectId: string
  taskId: string
}

export function AttachmentList({ projectId, taskId }: AttachmentListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    const fetchAttachments = async () => {
      try {
        const data = await getAttachments(projectId, taskId)
        setAttachments(data)
      } catch (error) {
        toast.error("Failed to load attachments")
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAttachments()
  }, [projectId, taskId])

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      const file = files[0] // For now, just handle one file at a time
      const attachment = await uploadAttachment(projectId, taskId, file)
      setAttachments([...attachments, attachment])
      toast.success("File uploaded successfully")
    } catch (error) {
      toast.error("Failed to upload file")
      console.error(error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (attachmentId: string) => {
    try {
      await deleteAttachment(projectId, taskId, attachmentId)
      setAttachments(attachments.filter((a) => a.id !== attachmentId))
      toast.success("Attachment deleted successfully")
    } catch (error) {
      toast.error("Failed to delete attachment")
      console.error(error)
    }
  }

  const handleDownload = async (attachmentId: string, fileName: string) => {
    try {
      const blob = await downloadAttachment(projectId, taskId, attachmentId)

      // Create a download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()

      // Clean up
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast.error("Failed to download file")
      console.error(error)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-gray-200 rounded animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
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
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center ${
            dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
          }`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="h-10 w-10 mx-auto text-gray-400" />
          <ImageIcon className="h-10 w-10 mx-auto text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">
            Drag and drop your file here, or{" "}
            <label className="text-blue-600 hover:text-blue-800 cursor-pointer">
              browse
              <input
                type="file"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
                disabled={isUploading}
              />
            </label>
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Supported file types: Images, documents, and other files up to 10MB
          </p>
          {isUploading && <p className="mt-2 text-sm text-blue-600">Uploading...</p>}
        </div>

        {attachments.length === 0 ? (
          <p className="text-center text-gray-500 py-4">No attachments yet</p>
        ) : (
          <div className="space-y-4">
            {attachments.map((attachment) => (
              <AttachmentItem
                key={attachment.id}
                attachment={attachment}
                onDelete={() => handleDelete(attachment.id)}
                onDownload={() => handleDownload(attachment.id, attachment.name)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
