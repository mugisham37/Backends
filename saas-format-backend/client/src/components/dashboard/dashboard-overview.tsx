"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatsCard } from "./stats-card"
import { ActivityFeed } from "./activity-feed"
import { ProjectList } from "../projects/project-list"
import { Users, CheckSquare, Clock, CreditCard } from "lucide-react"
import { getProjects } from "@/lib/project"
import { getUsers } from "@/lib/user"
import { getCurrentSubscription } from "@/lib/subscription"
import { toast } from "react-hot-toast"
import type { Project } from "@/lib/project"
import type { User } from "@/lib/auth"
import type { Subscription } from "@/lib/subscription"

export function DashboardOverview() {
  const [projects, setProjects] = useState<Project[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activities, setActivities] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsData, usersData, subscriptionData] = await Promise.all([
          getProjects(),
          getUsers(),
          getCurrentSubscription().catch(() => null),
        ])

        setProjects(projectsData)
        setUsers(usersData)
        setSubscription(subscriptionData)

        // Mock activities data
        setActivities([
          {
            id: "1",
            type: "task_completed",
            title: "Task Completed",
            description: "User completed the task 'Implement dashboard UI'",
            timestamp: "2 hours ago",
            user: {
              name: "John Doe",
              avatar: "",
            },
          },
          {
            id: "2",
            type: "project_updated",
            title: "Project Updated",
            description: "Project 'Website Redesign' was updated",
            timestamp: "4 hours ago",
            user: {
              name: "Jane Smith",
              avatar: "",
            },
          },
          {
            id: "3",
            type: "comment_added",
            title: "Comment Added",
            description: "New comment on task 'Fix login issue'",
            timestamp: "Yesterday",
            user: {
              name: "Mike Johnson",
              avatar: "",
            },
          },
        ])
      } catch (error) {
        toast.error("Failed to load dashboard data")
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Calculate stats
  const totalProjects = projects.length
  const activeProjects = projects.filter((p) => p.status.toLowerCase() === "active").length
  const totalUsers = users.length
  const subscriptionStatus = subscription ? subscription.status : "No subscription"

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Projects"
          value={isLoading ? "..." : totalProjects}
          icon={<CheckSquare className="h-5 w-5" />}
          trend={totalProjects > 0 ? { value: 12, isPositive: true } : undefined}
          description="Total projects created"
        />
        <StatsCard
          title="Active Projects"
          value={isLoading ? "..." : activeProjects}
          icon={<Clock className="h-5 w-5" />}
          trend={activeProjects > 0 ? { value: 8, isPositive: true } : undefined}
          description="Projects in progress"
        />
        <StatsCard
          title="Team Members"
          value={isLoading ? "..." : totalUsers}
          icon={<Users className="h-5 w-5" />}
          trend={totalUsers > 0 ? { value: 5, isPositive: true } : undefined}
          description="Active users"
        />
        <StatsCard
          title="Subscription"
          value={isLoading ? "..." : subscriptionStatus}
          icon={<CreditCard className="h-5 w-5" />}
          description={
            subscription
              ? `Renews on ${new Date(subscription.endDate || "").toLocaleDateString()}`
              : "No active subscription"
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectList projects={projects.slice(0, 3)} isLoading={isLoading} />
            </CardContent>
          </Card>
        </div>
        <div>
          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  )
}
