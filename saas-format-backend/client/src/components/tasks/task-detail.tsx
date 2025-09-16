"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/router"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getTask, deleteTask, updateTaskStatus, assignTask, unassignTask, getUsers } from "@/lib/project"
import { toast } from "react-hot-toast"
import { Edit, Trash2, AlertCircle, MessageSquare, Paperclip, User, Clock } from "lucide-react"
import Link from "next/link"
import type { Task } from "@/lib/project"
import type { User as AuthUser } from "@/lib/auth"
import { CommentList } from "../comments/comment-list"
import { AttachmentList } from "../attachments/attachment-list"

interface TaskDetailProps {
  projectId: string
  taskId: string
}

export function TaskDetail({ projectId, taskId }: TaskDetailProps) {
  const router = useRouter()
  const [task, setTask] = useState<Task | null>(null)
  const [users, setUsers] = useState<AuthUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isUpdatingAssignment, setIsUpdatingAssignment] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [taskData, userData] = await Promise.all([getTask(projectId, taskId), getUsers()])
        setTask(taskData)
        setUsers(userData)
      } catch (error) {
        toast.error("Failed to load task details")
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [projectId, taskId])

  // Format date to readable format
  const formatDate = (dateString?: string) => {
    if (!dateString) return "No due date"
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "todo":
      case "to do":
      case "backlog":
        return "bg-gray-100 text-gray-800"
      case "in progress":
        return "bg-blue-100 text-blue-800"
      case "review":
      case "in review":
        return "bg-purple-100 text-purple-800"
      case "done":
      case "completed":
        return "bg-green-100 text-green-800"
      case "blocked":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Get priority badge color
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-800"
      case "medium":
        return "bg-yellow-100 text-yellow-800"
      case "low":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteTask(projectId, taskId)
      toast.success("Task deleted successfully")
      router.push(`/projects/${projectId}`)
    } catch (error: any) {
      toast.error(error.message || "An error occurred")
      setIsDeleting(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!task) return
    setIsUpdatingStatus(true)
    try {
      const updatedTask = await updateTaskStatus(projectId, taskId, newStatus)
      setTask(updatedTask)
      toast.success(`Task status updated to ${newStatus}`)
    } catch (error: any) {
      toast.error(error.message || "Failed to update status")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleAssignmentChange = async (userId: string) => {
    if (!task) return
    setIsUpdatingAssignment(true)
    try {
      let updatedTask
      if (userId) {
        updatedTask = await assignTask(projectId, taskId, userId)
        toast.success("Task assigned successfully")
      } else {
        updatedTask = await unassignTask(projectId, taskId)
        toast.success("Task unassigned successfully")
      }
      setTask(updatedTask)
    } catch (error: any) {
      toast.error(error.message || "Failed to update assignment")
    } finally {
      setIsUpdatingAssignment(false)
    }
  }

  if (isLoading || !task) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="h-32 bg-gray-200 rounded animate-pulse mt-6"></div>
      </div>
    )
  }

  const assignedUser = users.find((user) => user.id === task.assignedTo)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{task.title}</h1>
            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>{task.status}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)}`}>{task.priority}</span>
          </div>
          <p className="text-sm text-gray-500">Created on {formatDate(task.createdAt)}</p>
        </div>
        <div className="flex space-x-2">
          <Link href={`/projects/${projectId}/tasks/${taskId}/edit`} passHref>
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
                <h3 className="text-lg font-medium text-red-800">Delete Task</h3>
                <p className="mt-1 text-sm text-red-700">
                  Are you sure you want to delete this task? This action cannot be undone and all associated comments
                  and attachments will be permanently deleted.
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
                    {isDeleting ? "Deleting..." : "Delete Task"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{task.description || "No description provided."}</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Status</h4>
                <div className="mt-1">
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={isUpdatingStatus}
                    className="w-full h-10 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="In Review">In Review</option>
                    <option value="Done">Done</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500">Priority</h4>
                <p className="mt-1 font-medium">{task.priority}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500">Due Date</h4>
                <div className="mt-1 flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-gray-400" />
                  <span>{formatDate(task.dueDate)}</span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500">Assigned To</h4>
                <div className="mt-1">
                  <select
                    value={task.assignedTo || ""}
                    onChange={(e) => handleAssignmentChange(e.target.value)}
                    disabled={isUpdatingAssignment}
                    className="w-full h-10 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                {assignedUser && (
                  <div className="mt-2 flex items-center">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-2">
                      {assignedUser.avatarUrl ? (
                        <img
                          src={assignedUser.avatarUrl || "/placeholder.svg"}
                          alt={`${assignedUser.firstName} ${assignedUser.lastName}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                    <span className="text-sm">
                      {assignedUser.firstName} {assignedUser.lastName}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500">Created By</h4>
                <p className="mt-1">{task.createdBy || "Unknown"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="comments">
        <TabsList className="mb-4">
          <TabsTrigger value="comments" className="flex items-center">
            <MessageSquare className="h-4 w-4 mr-2" />
            Comments
          </TabsTrigger>
          <TabsTrigger value="attachments" className="flex items-center">
            <Paperclip className="h-4 w-4 mr-2" />
            Attachments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comments">
          <CommentList projectId={projectId} taskId={taskId} />
        </TabsContent>

        <TabsContent value="attachments">
          <AttachmentList projectId={projectId} taskId={taskId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
