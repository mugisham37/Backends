import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, AlertCircle, Clock, MessageSquare, FileText } from "lucide-react"

interface ActivityItem {
  id: string
  type: "task_completed" | "task_created" | "comment_added" | "project_updated" | "alert"
  title: string
  description: string
  timestamp: string
  user: {
    name: string
    avatar?: string
  }
}

interface ActivityFeedProps {
  activities: ActivityItem[]
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "task_completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "task_created":
        return <Clock className="h-5 w-5 text-blue-500" />
      case "comment_added":
        return <MessageSquare className="h-5 w-5 text-purple-500" />
      case "project_updated":
        return <FileText className="h-5 w-5 text-orange-500" />
      case "alert":
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-4">
                <div className="mt-1">{getActivityIcon(activity.type)}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <span className="text-xs text-gray-500">{activity.timestamp}</span>
                  </div>
                  <p className="text-sm text-gray-600">{activity.description}</p>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                      {activity.user.avatar ? (
                        <img
                          src={activity.user.avatar || "/placeholder.svg"}
                          alt={activity.user.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-medium">{activity.user.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{activity.user.name}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
