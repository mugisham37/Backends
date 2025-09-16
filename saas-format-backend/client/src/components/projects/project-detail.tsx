"use client"

import { useState } from "react"
import { useRouter } from "next/router"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { deleteProject } from "@/lib/project"
import { toast } from "react-hot-toast"
import { Edit, Trash2, AlertCircle, Users, CheckSquare, MessageSquare, Paperclip } from "lucide-react"
import Link from "next/link"
import type { Project } from "@/lib/project"
import { TaskList } from "../tasks/task-list"
import { TeamMembers } from "../team/team-members"

interface ProjectDetailProps {
  project: Project
  isLoading?: boolean
}

export function ProjectDetail({ project, isLoading = false }: ProjectDetailProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Format date to readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800"
      case "completed":
        return "bg-blue-100 text-blue-800"
      case "on hold":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteProject(project.id)
      toast.success("Project deleted successfully")
      router.push("/projects")
    } catch (error: any) {
      toast.error(error.message || "An error occurred")
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="h-32 bg-gray-200 rounded animate-pulse mt-6"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(project.status)}`}>{project.status}</span>
          </div>
          <p className="text-sm text-gray-500">Created on {formatDate(project.createdAt)}</p>
        </div>
        <div className="flex space-x-2">
          <Link href={`/projects/${project.id}/edit`} passHref>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {showDeleteConfirm && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-red-800">Delete Project</h3>
                <p className="mt-1 text-sm text-red-700">
                  Are you sure you want to delete this project? This action cannot be undone and all associated tasks,
                  comments, and attachments will be permanently deleted.
                </p>
                <div className="mt-4 flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isDeleting ? "Deleting..." : "Delete Project"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">{project.description || "No description provided."}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="tasks">
        <TabsList className="mb-4">
          <TabsTrigger value="tasks" className="flex items-center">
            <CheckSquare className="h-4 w-4 mr-2" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center">
            <Users className="h-4 w-4 mr-2" />
            Team
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center">
            <MessageSquare className="h-4 w-4 mr-2" />
            Comments
          </TabsTrigger>
          <TabsTrigger value="attachments" className="flex items-center">
            <Paperclip className="h-4 w-4 mr-2" />
            Attachments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <TaskList projectId={project.id} />
        </TabsContent>

        <TabsContent value="team">
          <TeamMembers projectId={project.id} />
        </TabsContent>

        <TabsContent value="comments">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500 py-8">Comments feature coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500 py-8">Attachments feature coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
