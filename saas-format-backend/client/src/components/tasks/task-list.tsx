"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getTasks } from "@/lib/project"
import { toast } from "react-hot-toast"
import { Plus, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { TaskCard } from "./task-card"
import Link from "next/link"
import type { Task } from "@/lib/project"

interface TaskListProps {
  projectId: string
}

export function TaskList({ projectId }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null)

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const data = await getTasks(projectId)
        setTasks(data)
      } catch (error) {
        toast.error("Failed to load tasks")
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTasks()
  }, [projectId])

  // Filter tasks based on search term, status, and priority
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesStatus = statusFilter ? task.status.toLowerCase() === statusFilter.toLowerCase() : true
    const matchesPriority = priorityFilter ? task.priority.toLowerCase() === priorityFilter.toLowerCase() : true
    return matchesSearch && matchesStatus && matchesPriority
  })

  // Get unique statuses and priorities for filter dropdowns
  const statuses = Array.from(new Set(tasks.map((task) => task.status)))
  const priorities = Array.from(new Set(tasks.map((task) => task.priority)))

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-24 bg-gray-100 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <CardTitle>Tasks</CardTitle>
        <Link href={`/projects/${projectId}/tasks/new`} passHref>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-4">
            <select
              className="h-10 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter || ""}
              onChange={(e) => setStatusFilter(e.target.value || null)}
            >
              <option value="">All Statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              className="h-10 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={priorityFilter || ""}
              onChange={(e) => setPriorityFilter(e.target.value || null)}
            >
              <option value="">All Priorities</option>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900">No tasks found</h3>
            <p className="mt-2 text-sm text-gray-500">
              {searchTerm || statusFilter || priorityFilter
                ? "Try adjusting your search or filters to find what you're looking for."
                : "Get started by creating a new task."}
            </p>
            {!searchTerm && !statusFilter && !priorityFilter && (
              <div className="mt-6">
                <Link href={`/projects/${projectId}/tasks/new`} passHref>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Task
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <TaskCard key={task.id} task={task} projectId={projectId} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
