import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, Users, CheckSquare } from "lucide-react"
import type { Project } from "@/lib/project"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface ProjectCardProps {
  project: Project
  taskCount?: number
  memberCount?: number
}

export function ProjectCard({ project, taskCount = 0, memberCount = 0 }: ProjectCardProps) {
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

  return (
    <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-bold">{project.name}</CardTitle>
          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(project.status)}`}>{project.status}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <p className="text-sm text-gray-600 line-clamp-3 mb-4">{project.description || "No description provided."}</p>
        <div className="mt-auto">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>Created {formatDate(project.createdAt)}</span>
            </div>
            <div className="flex space-x-4">
              <div className="flex items-center space-x-1">
                <CheckSquare className="h-4 w-4" />
                <span>{taskCount} tasks</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>{memberCount} members</span>
              </div>
            </div>
          </div>
          <Link href={`/projects/${project.id}`} passHref>
            <Button variant="outline" className="w-full">
              View Project
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
