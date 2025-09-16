"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import AnalyticsChart from "./analytics-chart"
import AnalyticsMetricCard from "./analytics-metric-card"
import { getUsageStats, getMetricAggregations } from "@/lib/analytics"

export default function UsageStats() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usageStats, setUsageStats] = useState<any>(null)
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("month")
  const [apiUsageData, setApiUsageData] = useState<any[]>([])
  const [storageUsageData, setStorageUsageData] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch usage statistics
        const stats = await getUsageStats(period)
        setUsageStats(stats)

        // Calculate date range based on period
        const endDate = new Date()
        const startDate = new Date()

        if (period === "day") {
          startDate.setHours(0, 0, 0, 0)
        } else if (period === "week") {
          startDate.setDate(startDate.getDate() - 7)
        } else if (period === "month") {
          startDate.setMonth(startDate.getMonth() - 1)
        } else if (period === "year") {
          startDate.setFullYear(startDate.getFullYear() - 1)
        }

        // Fetch API usage data
        const apiUsage = await getMetricAggregations(
          "api_calls",
          "sum",
          startDate.toISOString(),
          endDate.toISOString(),
          period === "day" ? "hour" : period === "week" ? "day" : "day",
        )
        setApiUsageData(apiUsage)

        // Fetch storage usage data
        const storageUsage = await getMetricAggregations(
          "storage_used",
          "max",
          startDate.toISOString(),
          endDate.toISOString(),
          period === "day" ? "hour" : period === "week" ? "day" : "day",
        )
        setStorageUsageData(storageUsage)
      } catch (err: any) {
        console.error("Error fetching usage statistics:", err)
        setError(err.message || "Failed to load usage statistics")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [period])

  const handlePeriodChange = (value: string) => {
    setPeriod(value as "day" | "week" | "month" | "year")
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
        <Skeleton className="h-[300px]" />
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
        <h2 className="text-2xl font-bold tracking-tight">Usage Statistics</h2>
        <Tabs value={period} onValueChange={handlePeriodChange}>
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {usageStats ? (
        <>
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <AnalyticsMetricCard title="API Calls" value={usageStats.apiCalls} description={`This ${period}`} />
            <AnalyticsMetricCard
              title="Storage Used"
              value={usageStats.storageUsed}
              description={`This ${period}`}
              formatter={(val) => `${(Number(val) / 1024 / 1024).toFixed(2)} MB`}
            />
            <AnalyticsMetricCard title="Active Users" value={usageStats.activeUsers} description={`This ${period}`} />
            <AnalyticsMetricCard title="Projects" value={usageStats.totalProjects} description={`Total projects`} />
          </div>

          {/* API Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>API Usage</CardTitle>
              <CardDescription>Number of API calls over time</CardDescription>
            </CardHeader>
            <CardContent>
              <AnalyticsChart
                data={apiUsageData}
                xKey="period"
                yKey="value"
                height={300}
                type="bar"
                dateFormat={period === "day" ? "HH:mm" : "MMM d"}
              />
            </CardContent>
          </Card>

          {/* Storage Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Storage Usage</CardTitle>
              <CardDescription>Storage consumption over time (MB)</CardDescription>
            </CardHeader>
            <CardContent>
              <AnalyticsChart
                data={storageUsageData.map((item) => ({
                  ...item,
                  value: item.value / 1024 / 1024, // Convert bytes to MB
                }))}
                xKey="period"
                yKey="value"
                height={300}
                type="area"
                dateFormat={period === "day" ? "HH:mm" : "MMM d"}
              />
            </CardContent>
          </Card>

          {/* Task Completion Rate */}
          <Card>
            <CardHeader>
              <CardTitle>Task Completion Rate</CardTitle>
              <CardDescription>Completed tasks vs. total tasks</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center">
                <div className="relative h-40 w-40">
                  <svg className="h-full w-full" viewBox="0 0 100 100">
                    {/* Background circle */}
                    <circle className="stroke-gray-200" cx="50" cy="50" r="40" strokeWidth="10" fill="none" />
                    {/* Progress circle */}
                    <circle
                      className="stroke-blue-500"
                      cx="50"
                      cy="50"
                      r="40"
                      strokeWidth="10"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${(usageStats.completedTasks / usageStats.totalTasks) * 251.2} 251.2`}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold">
                      {Math.round((usageStats.completedTasks / usageStats.totalTasks) * 100)}%
                    </span>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-500">
                    {usageStats.completedTasks} completed out of {usageStats.totalTasks} total tasks
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Usage Data</CardTitle>
            <CardDescription>No usage statistics available for the selected period</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}
