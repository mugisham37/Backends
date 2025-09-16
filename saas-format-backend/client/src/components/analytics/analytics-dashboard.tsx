"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Plus } from "lucide-react"
import AnalyticsChart from "./analytics-chart"
import AnalyticsMetricCard from "./analytics-metric-card"
import AnalyticsTable from "./analytics-table"
import { getDashboards, getEventCounts, getMetricAggregations } from "@/lib/analytics"
import { useRouter } from "next/navigation"

export default function AnalyticsDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboards, setDashboards] = useState<any[]>([])
  const [activeDashboard, setActiveDashboard] = useState<string>("default")
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({})
  const [userMetrics, setUserMetrics] = useState<any[]>([])
  const [apiMetrics, setApiMetrics] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch dashboards
        const dashboardsData = await getDashboards()
        setDashboards(dashboardsData)

        // Fetch event counts for the last 30 days
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const eventCountsData = await getEventCounts(thirtyDaysAgo.toISOString(), new Date().toISOString())
        setEventCounts(eventCountsData)

        // Fetch user metrics
        const userMetricsData = await getMetricAggregations(
          "active_users",
          "avg",
          thirtyDaysAgo.toISOString(),
          new Date().toISOString(),
          "day",
        )
        setUserMetrics(userMetricsData)

        // Fetch API metrics
        const apiMetricsData = await getMetricAggregations(
          "api_response_time",
          "avg",
          thirtyDaysAgo.toISOString(),
          new Date().toISOString(),
          "day",
        )
        setApiMetrics(apiMetricsData)
      } catch (err: any) {
        console.error("Error fetching analytics data:", err)
        setError(err.message || "Failed to load analytics data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleCreateDashboard = () => {
    router.push("/dashboard/analytics/dashboards/create")
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[200px]" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h2>
        <Button onClick={handleCreateDashboard}>
          <Plus className="mr-2 h-4 w-4" />
          Create Dashboard
        </Button>
      </div>

      {dashboards.length > 0 ? (
        <Tabs defaultValue={activeDashboard} onValueChange={setActiveDashboard}>
          <TabsList>
            <TabsTrigger value="default">Default</TabsTrigger>
            {dashboards.map((dashboard) => (
              <TabsTrigger key={dashboard.id} value={dashboard.id}>
                {dashboard.name}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="default" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <AnalyticsMetricCard
                title="Active Users"
                value={eventCounts["user_login"] || 0}
                description="Last 30 days"
                trend={10}
                trendLabel="vs previous period"
              />
              <AnalyticsMetricCard
                title="New Projects"
                value={eventCounts["project_created"] || 0}
                description="Last 30 days"
                trend={5}
                trendLabel="vs previous period"
              />
              <AnalyticsMetricCard
                title="Completed Tasks"
                value={eventCounts["task_completed"] || 0}
                description="Last 30 days"
                trend={-2}
                trendLabel="vs previous period"
              />
              <AnalyticsMetricCard
                title="API Calls"
                value={eventCounts["api_request"] || 0}
                description="Last 30 days"
                trend={15}
                trendLabel="vs previous period"
              />
            </div>

            {/* User Activity Chart */}
            <Card>
              <CardHeader>
                <CardTitle>User Activity</CardTitle>
                <CardDescription>Daily active users over the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsChart data={userMetrics} xKey="period" yKey="value" height={300} type="line" />
              </CardContent>
            </Card>

            {/* API Performance */}
            <Card>
              <CardHeader>
                <CardTitle>API Performance</CardTitle>
                <CardDescription>Average response time (ms) over the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsChart data={apiMetrics} xKey="period" yKey="value" height={300} type="area" />
              </CardContent>
            </Card>

            {/* Top Events */}
            <Card>
              <CardHeader>
                <CardTitle>Top Events</CardTitle>
                <CardDescription>Most frequent events in the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsTable
                  data={Object.entries(eventCounts)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10)}
                  columns={[
                    { header: "Event", accessor: "name" },
                    { header: "Count", accessor: "count" },
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {dashboards.map((dashboard) => (
            <TabsContent key={dashboard.id} value={dashboard.id} className="space-y-6">
              {/* Custom dashboard widgets would be rendered here */}
              <Card>
                <CardHeader>
                  <CardTitle>{dashboard.name}</CardTitle>
                  <CardDescription>{dashboard.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {dashboard.widgets?.map((widget: any) => (
                      <div
                        key={widget.id}
                        className="border rounded-md p-4"
                        style={{
                          gridColumn: `span ${widget.position.width} / span ${widget.position.width}`,
                          gridRow: `span ${widget.position.height} / span ${widget.position.height}`,
                        }}
                      >
                        <h3 className="font-medium mb-2">{widget.name}</h3>
                        {/* Widget content would be rendered based on widget.type */}
                        <div className="h-40 bg-gray-100 rounded flex items-center justify-center">
                          Widget: {widget.type}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Dashboards Found</CardTitle>
            <CardDescription>Create your first analytics dashboard to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleCreateDashboard}>
              <Plus className="mr-2 h-4 w-4" />
              Create Dashboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
