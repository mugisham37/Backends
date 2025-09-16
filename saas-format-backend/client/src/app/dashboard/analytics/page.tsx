"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import AnalyticsDashboard from "@/components/analytics/analytics-dashboard"
import UsageStats from "@/components/analytics/usage-stats"

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState("dashboards")

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Monitor your application performance and user engagement</p>
      </div>

      <Tabs defaultValue="dashboards" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
          <TabsTrigger value="usage">Usage Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboards" className="space-y-6">
          <AnalyticsDashboard />
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <UsageStats />
        </TabsContent>
      </Tabs>
    </div>
  )
}
