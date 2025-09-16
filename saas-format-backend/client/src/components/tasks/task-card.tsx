import { Card, CardContent } from "@/components/ui/card"
import { Clock, AlertCircle, CheckCircle, User } from "lucide-react"
import Link from "next/link"
import type { Task } from "@/lib/project"

interface TaskCardProps {
  task: Task
  projectId: string
}

export function TaskCard({ task, projectId }: TaskCardProps) {
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

  // Get priority badge color and icon
  const getPriorityInfo = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return {
          color: "bg-red-100 text-red-800",
          icon: <AlertCircle className="h-3 w-3" />,
        }
      case "medium":
        return {
          color: "bg-yellow-100 text-yellow-800",
          icon: null,
        }
      case "low":
        return {
          color: "bg-green-100 text-green-800",
          icon: <CheckCircle className="h-3 w-3" />,
        }
      default:
        return {
          color: "bg-gray-100 text-gray-800",
          icon: null,
        }
    }
  }

  const priorityInfo = getPriorityInfo(task.priority)

  return (
    <Link href={`/projects/${projectId}/tasks/${task.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{task.title}</h3>
              {task.description && <p className="mt-1 text-sm text-gray-600 line-clamp-2">{task.description}</p>}
            </div>
            <div className="flex flex-col items-end space-y-2 ml-4">
              <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(task.status)}`}>{task.status}</span>
              <span className={`text-xs px-2 py-1 rounded-full flex items-center ${priorityInfo.color}`}>
                {priorityInfo.icon && <span className="mr-1">{priorityInfo.icon}</span>}
                {task.priority}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              <span>{formatDate(task.dueDate)}</span>
            </div>
            {task.assignedTo && (
              <div className="flex items-center">
                <User className="h-3 w-3 mr-1" />
                <span>Assigned</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
