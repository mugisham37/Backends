import { Card, CardContent } from "@/components/ui/card"
import { Mail } from "lucide-react"
import type { User as UserType } from "@/lib/auth"

interface UserCardProps {
  user: UserType
}

export function UserCard({ user }: UserCardProps) {
  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  // Get role badge color
  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "bg-purple-100 text-purple-800"
      case "owner":
        return "bg-blue-100 text-blue-800"
      case "member":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl || "/placeholder.svg"}
                alt={`${user.firstName} ${user.lastName}`}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-lg font-medium text-gray-600">
                {getInitials(`${user.firstName} ${user.lastName}`)}
              </span>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">
                {user.firstName} {user.lastName}
              </h3>
              <span className={`text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(user.role)}`}>{user.role}</span>
            </div>
            <div className="flex items-center text-sm text-gray-500 mt-1">
              <Mail className="h-3 w-3 mr-1" />
              <span>{user.email}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
