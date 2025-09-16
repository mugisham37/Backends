"use client"

import { Button } from "@/components/ui/button"
import {
  Download,
  Trash2,
  File,
  FileText,
  ImageIcon,
  Film,
  Music,
  Archive,
  Code,
  Database,
  FileSpreadsheet,
} from "lucide-react"
import type { Attachment } from "@/lib/project"

interface AttachmentItemProps {
  attachment: Attachment
  onDelete: () => void
  onDownload: () => void
}

export function AttachmentItem({ attachment, onDelete, onDownload }: AttachmentItemProps) {
  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // Get icon based on file type
  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase()

    if (type.includes("image")) {
      return <ImageIcon className="h-6 w-6 text-blue-500" />
    } else if (type.includes("video")) {
      return <Film className="h-6 w-6 text-purple-500" />
    } else if (type.includes("audio")) {
      return <Music className="h-6 w-6 text-green-500" />
    } else if (type.includes("zip") || type.includes("rar") || type.includes("tar") || type.includes("gz")) {
      return <Archive className="h-6 w-6 text-yellow-500" />
    } else if (type.includes("pdf") || type.includes("doc") || type.includes("text")) {
      return <FileText className="h-6 w-6 text-red-500" />
    } else if (type.includes("code") || type.includes("json") || type.includes("xml") || type.includes("html")) {
      return <Code className="h-6 w-6 text-gray-500" />
    } else if (type.includes("csv") || type.includes("excel") || type.includes("spreadsheet")) {
      return <FileSpreadsheet className="h-6 w-6 text-green-600" />
    } else if (type.includes("sql") || type.includes("database")) {
      return <Database className="h-6 w-6 text-blue-600" />
    } else {
      return <File className="h-6 w-6 text-gray-500" />
    }
  }

  // Format date to readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
      <div className="flex items-center space-x-3">
        {getFileIcon(attachment.fileType)}
        <div>
          <h4 className="font-medium text-gray-900">{attachment.name}</h4>
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <span>{formatFileSize(attachment.fileSize)}</span>
            <span>•</span>
            <span>{formatDate(attachment.createdAt)}</span>
          </div>
        </div>
      </div>
      <div className="flex space-x-2">
        <Button variant="ghost" size="sm" onClick={onDownload} className="h-8 w-8 p-0">
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
